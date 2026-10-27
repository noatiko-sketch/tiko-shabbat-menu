import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {shoppingAction,shoppingSnapshot,shoppingCategories} from '../lib/shopping.ts';
import {ShoppingMutations} from '../lib/shopping-mutations.ts';
import {proxyDriveShopping} from '../lib/drive-proxy.ts';
import {driveAction,initializeDrive,driveSnapshot} from '../lib/drive-engine.ts';

const now='2026-10-27T08:00:00Z';let serial=0;
const state=()=>({anchor_saturday:'2026-09-26',anchor_week:1,history:[],deliveries:[{keep:'original'}],menu_drafts:{},unknown:{keep:true}});
const action=(s,fields)=>({revision:s.shopping?.revision||0,mutationId:`shopping-test-${++serial}`,...fields});
const apply=(s,fields,actor='אבא')=>shoppingAction(s,action(s,fields),actor,now).state;
const add=(s,name='עגבניות',category='produce',quantity='2 ק״ג')=>apply(s,{type:'shopping_add',name,category,quantity});

test('shopping starts empty without writing, seeding products or altering existing menu data',()=>{
 const s=state(),before=structuredClone(s),snapshot=shoppingSnapshot(s);
 assert.deepEqual(snapshot.shopping,{revision:0,products:[],items:[],receipts:[]});assert.deepEqual(s,before);
 assert.equal(shoppingCategories.canned,'שימורים');assert.equal(shoppingCategories.general,'כללי');
 assert.equal(Object.keys(shoppingCategories).length,10);
});
test('new products are learned once, quantities persist, and the catalog survives removal',()=>{
 const original=state();let s=add(original);assert.equal(original.shopping,undefined);
 const id=s.shopping.products[0].id;assert.equal(s.shopping.items[0].quantity,'2 ק״ג');
 s=add(s,'  עגבניות  ','general','1 ק״ג');assert.equal(s.shopping.products.length,1);assert.equal(s.shopping.items.length,1);assert.equal(s.shopping.products[0].category,'produce');assert.equal(s.shopping.items[0].quantity,'1 ק״ג');
 s=apply(s,{type:'shopping_remove',productId:id});assert.equal(s.shopping.items.length,0);assert.equal(s.shopping.products.length,1);
 s=apply(s,{type:'shopping_add',productId:id});assert.equal(s.shopping.items[0].productId,id);
 assert.deepEqual(s.unknown,original.unknown);assert.deepEqual(s.deliveries,original.deliveries);assert.deepEqual(s.menu_drafts,original.menu_drafts);
});
test('bought items can be undone; clearing bought items preserves missing items and all catalog products',()=>{
 let s=add(add(state()),'חלב','dairy','2');const [tomato,milk]=s.shopping.products;
 s=apply(s,{type:'shopping_toggle',productId:tomato.id,bought:true});assert.equal(s.shopping.items[0].updated_by,'אבא');
 s=apply(s,{type:'shopping_toggle',productId:tomato.id,bought:false});assert.equal(s.shopping.items[0].bought,false);
 s=apply(s,{type:'shopping_toggle',productId:tomato.id,bought:true});
 s=apply(s,{type:'shopping_clear_bought'});assert.deepEqual(s.shopping.items.map(i=>i.productId),[milk.id]);assert.equal(s.shopping.products.length,2);
 s=apply(s,{type:'shopping_add',productId:tomato.id});assert.equal(s.shopping.items.find(i=>i.productId===tomato.id).bought,false);
});
test('recategorization moves a general product in catalog and active list without changing quantity or bought state',()=>{
 let s=add(state(),'טונה','general','3 קופסאות'),product=s.shopping.products[0];
 s=apply(s,{type:'shopping_toggle',productId:product.id,bought:true});const item=structuredClone(s.shopping.items[0]);
 s=apply(s,{type:'shopping_recategorize',productId:product.id,category:'canned'});
 assert.equal(s.shopping.products[0].category,'canned');assert.deepEqual(s.shopping.items[0],item);
 s=apply(s,{type:'shopping_remove',productId:product.id});
 s=apply(s,{type:'shopping_recategorize',productId:product.id,category:'general'});assert.equal(s.shopping.products[0].category,'general');
});
test('conflicts and invalid actions never mutate original data; retrying a mutation writes once',()=>{
 const original=state(),a=action(original,{type:'shopping_add',name:'חלב',category:'dairy'}),first=shoppingAction(original,a,'אבא',now);
 const retry=shoppingAction(first.state,a,'אבא',now);assert.equal(retry.changed,false);assert.deepEqual(retry.state,first.state);
 assert.throws(()=>shoppingAction(first.state,a,'נעה',now),e=>e.status===409);
 const before=structuredClone(first.state);
 assert.throws(()=>shoppingAction(first.state,{...a,mutationId:'stale-mutation'},'נעה',now),e=>e.status===409);
 for(const fields of [
  {type:'shopping_add',name:' ',category:'produce'},
  {type:'shopping_add',name:'חלב',category:'__proto__'},
  {type:'shopping_add',name:'חלב',category:'dairy',quantity:'x'.repeat(61)},
  {type:'shopping_toggle',productId:'missing',bought:true},
  {type:'shopping_toggle',productId:before.shopping.products[0].id,bought:'yes'},
  {type:'shopping_recategorize',productId:before.shopping.products[0].id,category:'no-such-category'},
  {type:'shopping_unknown'},
 ])assert.throws(()=>apply(first.state,fields));
 assert.throws(()=>apply(first.state,{type:'shopping_clear_bought'},'stranger'),e=>e.status===401);
 assert.deepEqual(first.state,before);assert.equal(shoppingSnapshot(first.state).shopping.receipts.length,0);
});

test('rapid optimistic taps are visible immediately and persisted serially with confirmed revisions',async()=>{
 let live=add(add(state()),'חלב','dairy'),view=shoppingSnapshot(live),release;const revisions=[];
 const queue=new ShoppingMutations(()=>view,s=>view=s,()=>{},'אבא');
 const [a,b]=view.shopping.products;
 const first=action(live,{type:'shopping_toggle',productId:a.id,bought:true});
 const second=action(live,{type:'shopping_toggle',productId:b.id,bought:true});
 const p1=queue.enqueue(first,revision=>{revisions.push(revision);return new Promise(r=>release=()=>{live=shoppingAction(live,{...first,revision},'אבא',now).state;r(shoppingSnapshot(live));});});
 const p2=queue.enqueue(second,async revision=>{revisions.push(revision);live=shoppingAction(live,{...second,revision},'אבא',now).state;return shoppingSnapshot(live);});
 assert.ok(view.shopping.items.every(i=>i.bought));assert.deepEqual(revisions,[2]);release();await Promise.all([p1,p2]);assert.deepEqual(revisions,[2,3]);assert.ok(live.shopping.items.every(i=>i.bought));
});
test('queued additions can immediately recategorize and check a newly learned product',async()=>{
 let live=state(),view=shoppingSnapshot(live),release;
 const queue=new ShoppingMutations(()=>view,s=>view=s,()=>{},'אבא');
 const a=action(live,{type:'shopping_add',name:'טונה',category:'general'});
 const first=queue.enqueue(a,revision=>new Promise(r=>release=()=>{live=shoppingAction(live,{...a,revision},'אבא',now).state;r(shoppingSnapshot(live));}));
 const productId=view.shopping.products[0].id;
 const b=action(live,{type:'shopping_recategorize',productId,category:'canned'});
 const second=queue.enqueue(b,async revision=>{live=shoppingAction(live,{...b,revision},'אבא',now).state;return shoppingSnapshot(live);});
 const c=action(live,{type:'shopping_toggle',productId,bought:true});
 const third=queue.enqueue(c,async revision=>{live=shoppingAction(live,{...c,revision},'אבא',now).state;return shoppingSnapshot(live);});
 assert.equal(view.shopping.products[0].category,'canned');assert.equal(view.shopping.items[0].bought,true);
 release();await Promise.all([first,second,third]);assert.deepEqual(view,shoppingSnapshot(live));
});
test('a failed write rolls back optimistic taps and cancels dependent writes',async()=>{
 let view=shoppingSnapshot(add(state())),before=structuredClone(view),reject,sends=0;
 const queue=new ShoppingMutations(()=>view,s=>view=s,()=>{},'אבא'),id=view.shopping.products[0].id;
 const p1=queue.enqueue({type:'shopping_toggle',productId:id,bought:true,mutationId:'optimistic-first'},()=>new Promise((_,r)=>reject=r));
 const p2=queue.enqueue({type:'shopping_remove',productId:id,mutationId:'optimistic-second'},async()=>{sends++;return view;});
 const done=Promise.allSettled([p1,p2]);assert.equal(view.shopping.items.length,0);reject(Error('offline'));await done;assert.deepEqual(view,before);assert.equal(sends,0);
});

function bridge(initial){
 let live=structuredClone(initial),held=false;const counts={reads:0,writes:0};
 const sandbox={console,Date,PropertiesService:{getScriptProperties:()=>({getProperty:()=> 't'.repeat(48)})},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},DriveApp:{getFileById:()=>({getBlob:()=>{counts.reads++;return {getDataAsString:()=>JSON.stringify(live)};},setContent:text=>{assert.ok(held);counts.writes++;live=JSON.parse(text);}})},LockService:{getScriptLock:()=>({tryLock:()=>{held=true;return true;},releaseLock:()=>held=false})}};
 vm.runInNewContext(readFileSync(new URL('../google/Code.gs',import.meta.url),'utf8'),sandbox);
 return {counts,live:()=>live,post:body=>sandbox.doPost({postData:{contents:JSON.stringify({token:'t'.repeat(48),actor:'אבא',...body})}})};
}
test('bundled Apps Script reads without menu writes, locks writes, rejects stale data, and preserves the family file',()=>{
 const original=state(),h=bridge(original);assert.equal(h.post({type:'shopping_snapshot'}).shopping.revision,0);assert.equal(h.counts.writes,0);
 assert.deepEqual(h.live(),original);
 const a=action(original,{type:'shopping_add',name:'טונה',category:'canned'});assert.ok(h.post(a).snapshot);assert.equal(h.counts.writes,1);
 assert.ok(h.post(a).snapshot);assert.equal(h.counts.writes,1);
 assert.equal(h.post({...a,mutationId:'another-request',actor:'נעה'}).http_status,409);assert.equal(h.counts.writes,1);
 assert.equal(h.post({type:'shopping_snapshot',actor:'stranger'}).http_status,401);
 assert.equal(h.post({...a,token:'wrong'}).http_status,401);
 assert.deepEqual(h.live().unknown,original.unknown);assert.deepEqual(h.live().menu_drafts,{});
});
test('shopping proxy forwards identity and action to the existing Drive bridge only',async()=>{
 const h=bridge(state()),config={TIKO_BRIDGE_URL:'https://script.google.com/macros/s/test/exec',TIKO_BRIDGE_TOKEN:'t'.repeat(48)};let calls=0;
 const transport=async(url,options)=>{calls++;assert.equal(url,config.TIKO_BRIDGE_URL);return Response.json(h.post(JSON.parse(options.body)));};
 const request=(fields)=>new Request('https://example.test/api/shopping',{method:'POST',headers:{'x-family-member':encodeURIComponent('נעה'),'origin':'https://example.test'},body:JSON.stringify(fields)});
 const result=await proxyDriveShopping(request(action(state(),{type:'shopping_add',name:'חלב',category:'dairy'})),config,transport);assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');assert.equal(h.live().shopping.items[0].updated_by,'נעה');
 assert.equal((await proxyDriveShopping(new Request('https://example.test/api/shopping'),config,transport)).status,401);
 assert.equal((await proxyDriveShopping(new Request('https://example.test/api/shopping',{method:'POST',headers:{origin:'https://evil.test','x-family-member':encodeURIComponent('אבא')},body:'{}'}),config,transport)).status,403);
 assert.equal((await proxyDriveShopping(request({type:'remove'}),config,transport)).status,400);assert.equal(calls,1);
 const get=await proxyDriveShopping(new Request('https://example.test/api/shopping',{headers:{'x-family-member':encodeURIComponent('אבא')}}),config,transport);assert.equal((await get.json()).shopping.products[0].name,'חלב');
 const wrong=await proxyDriveShopping(request(action(state(),{type:'shopping_clear_bought'})),config,async()=>Response.json({snapshot:{status:'ready',storage:'google-drive',state_id:'other'}}));assert.equal(wrong.status,503);
 const old=await proxyDriveShopping(new Request('https://example.test/api/shopping',{headers:{'x-family-member':encodeURIComponent('אבא')}}),config,async()=>Response.json({status:'ready',storage:'google-drive',state_id:'1wc9VbyXuLl9QTWVPLUYiU1vUQjz1vmZI'}));assert.equal(old.status,503);assert.match((await old.json()).detail,/Apps Script/);
});
test('existing menu mutations preserve the new shopping fields',()=>{
 const ctx={upcoming:'2026-10-31',now},s=initializeDrive(add(state()),'- מרק אפונה',ctx);driveSnapshot(s,ctx.upcoming,ctx);
 const before=structuredClone(s.shopping),result=driveAction(s,{type:'add',saturday:ctx.upcoming,meal:'friday',dish:{name:'סלט חדש',category:'salad'},revision:s.menu_revisions[ctx.upcoming]},'נעה',ctx);
 assert.deepEqual(result.state.shopping,before);
});
