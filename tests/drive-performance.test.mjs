import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {initializeDrive,driveSnapshot,driveAction,markDriveSeen} from '../lib/drive-engine.ts';
import {MenuMutations} from '../lib/menu-mutations.ts';
const ctx={upcoming:'2026-10-24',now:'2026-10-20T17:00:00Z'};
function state(){const s=initializeDrive({anchor_saturday:'2026-09-26',anchor_week:1,history:[],deliveries:[{sent_at:'preserve'}],manual_dishes:[],custom_dishes:[],excluded_dishes:[],unknown:{keep:true}},Array.from({length:160},(_,i)=>'- סלט ירקות '+i).join('\n'),ctx);driveSnapshot(s,ctx.upcoming,ctx);return s;}
const action=(s,a)=>({saturday:ctx.upcoming,revision:s.menu_revisions[ctx.upcoming],catalogRevision:s.catalog_revision||0,compact:true,...a});
function harness(original){let live=structuredClone(original),held=false,mutateBeforeLock=null;const counts={reads:0,foods:0,writes:0,locks:0};const sandbox={console,Date,Utilities:{formatDate:()=> '2026-10-20'},PropertiesService:{getScriptProperties:()=>({getProperty:()=> 't'.repeat(48)})},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},DriveApp:{getFileById:id=>{if(id==='1eVmval7caUC1sHWiyrozuA0DpqyX1qoH'){counts.foods++;return {getBlob:()=>({getDataAsString:()=>''})};}return {getBlob:()=>{counts.reads++;return {getDataAsString:()=>JSON.stringify(live)};},setContent:text=>{assert.ok(held,'every shared write holds the script lock');counts.writes++;live=JSON.parse(text);}};}},LockService:{getScriptLock:()=>({tryLock:()=>{counts.locks++;held=true;if(mutateBeforeLock){live=mutateBeforeLock(live);mutateBeforeLock=null;}return true;},releaseLock:()=>{held=false;}})}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(new URL('../google/Code.gs',import.meta.url),'utf8'),sandbox);return {counts,live:()=>live,race:fn=>mutateBeforeLock=fn,post:body=>sandbox.doPost({postData:{contents:JSON.stringify({token:'t'.repeat(48),actor:'נעה',...body})}})};}
test('unchanged shared reads use one fresh state read, no food reads, writes or locks',()=>{
 const s=state();markDriveSeen(s,'נעה',ctx.upcoming,ctx);const h=harness(s);
 for(let i=0;i<4;i++)assert.equal(h.post({type:'snapshot',saturday:ctx.upcoming,compact:true,viewed:true}).status,'ready');
 assert.deepEqual(h.counts,{reads:4,foods:0,writes:0,locks:0});
 assert.deepEqual(h.live(),s);
});
test('first view re-reads after acquiring the write lock and preserves intervening family edits',()=>{
 const s=state(),h=harness(s);
 h.race(latest=>driveAction(latest,action(latest,{type:'add',meal:'friday',dish:{name:'מרק חדש',category:'soup'}}),'אבא',ctx).state);
 const result=h.post({type:'snapshot',saturday:ctx.upcoming,compact:true,viewed:true});
 assert.ok(result.current.friday.dishes.some(d=>d?.name==='מרק חדש'));
 assert.equal(h.live().family_status['נעה'].seen_revision,result.revision);
 assert.deepEqual(h.counts,{reads:2,foods:0,writes:1,locks:1});
});
test('a completed move writes once; replay and already-seen requests never write again',()=>{
 const s=state(),h=harness(s),a=action(s,{type:'move',meal:'friday',index:0,toIndex:1,viewed:true,mutationId:'move-once-12345'});
 const first=h.post(a);assert.equal(first.snapshot.revision,s.menu_revisions[ctx.upcoming]+1);assert.equal(h.counts.writes,1);
 const again=h.post(a);assert.equal(again.snapshot.revision,first.snapshot.revision);assert.equal(h.counts.writes,1);
 h.post({type:'seen',saturday:ctx.upcoming,revision:first.snapshot.revision});assert.equal(h.counts.writes,1);
 h.post({type:'snapshot',saturday:ctx.upcoming,compact:true,viewed:true});assert.equal(h.counts.writes,1);
 assert.equal(h.counts.foods,0);assert.deepEqual(h.live().unknown,{keep:true});assert.deepEqual(h.live().deliveries,s.deliveries);
});
test('simultaneous family menu and catalog edits reject stale revisions without any losing write',()=>{
 const s=state(),h=harness(s),a=action(s,{type:'catalog_save',dish:{name:'מנה משותפת',category:'extra'},mutationId:'catalog-noa-12345'});
 assert.ok(h.post(a).snapshot);
 const losing=h.post({...a,actor:'אבא',mutationId:'catalog-dad-12345',dish:{name:'מנה אחרת',category:'extra'}});
 assert.equal(losing.http_status,409);assert.equal(h.counts.writes,1);assert.equal(h.live().dish_catalog.some(d=>d.name==='מנה אחרת'),false);
 const fresh=h.live(),move=action(fresh,{type:'move',meal:'friday',index:0,toIndex:1});assert.ok(h.post(move).snapshot);
 assert.equal(h.post({...move,actor:'אבא'}).http_status,409);assert.equal(h.counts.writes,2);
});
test('compact payload preserves current shared fields and omits repeated candidate/history copies',()=>{
 const s=state(),full=driveSnapshot(s,ctx.upcoming,ctx),compact=driveSnapshot(s,ctx.upcoming,ctx,true,true);
 for(const key of ['current','revision','catalog_revision','catalog','categories','family_status','storage','state_id'])assert.deepEqual(compact[key],full[key]);
 assert.equal(compact.previous,undefined);assert.deepEqual(compact.candidates,{});
 const fullBytes=Buffer.byteLength(JSON.stringify(full)),compactBytes=Buffer.byteLength(JSON.stringify(compact));
 assert.ok(compactBytes<fullBytes*.65,`${compactBytes} vs ${fullBytes}`);
 console.log(JSON.stringify({benchmark:'snapshot-bytes-160-dishes',fullBytes,compactBytes,reductionPercent:Math.round(100*(1-compactBytes/fullBytes))}));
});
test('all optimistic edits are immediately visible; background failure rolls back and cancels dependent writes',async()=>{
 let view={...driveSnapshot(state(),ctx.upcoming,ctx),catalog_revision:0},original=structuredClone(view),reject,sendCount=0,status;
 const queue=new MenuMutations(()=>view,s=>view=s,(saving,blocking)=>status={saving,blocking});
 const p1=queue.enqueue({type:'catalog_save',saturday:ctx.upcoming,dish:{name:'מרק בדיקה',category:'auto'},actor:'נעה'},()=>{sendCount++;return new Promise((_,r)=>reject=r);});
 assert.ok(view.catalog.some(d=>d.name==='מרק בדיקה'&&d.category==='soup'));
 const p2=queue.enqueue({type:'add',saturday:ctx.upcoming,meal:'friday',dish:{name:'מרק בדיקה',category:'soup'},actor:'נעה'},async()=>{sendCount++;return view;});
 assert.ok(view.current.friday.dishes.some(d=>d?.name==='מרק בדיקה'));assert.deepEqual(status,{saving:true,blocking:false});
 const results=Promise.allSettled([p1,p2]);reject(Error('failed'));
 await results;assert.equal(sendCount,1);assert.deepEqual(view,original);assert.deepEqual(status,{saving:false,blocking:false});
});
test('optimistic category rename/remove and like preserve unrelated profiles and source data',async()=>{
 let view=driveSnapshot(state(),ctx.upcoming,ctx),source=structuredClone(view),rev=view.revision;
 view.current.friday.dishes=view.current.friday.dishes.filter(Boolean);view.current.lunch.dishes=view.current.lunch.dishes.filter(Boolean);
 let release;const queue=new MenuMutations(()=>view,s=>view=s,()=>{});
 const p=queue.enqueue({type:'family_approve',saturday:ctx.upcoming,actor:'אבא'},()=>new Promise(r=>release=r));
 assert.equal(view.family_status.find(x=>x.name==='אבא').approved_revision,rev);assert.equal(view.current.approved,true);assert.equal(source.current.approved,false);
 release(view);await p;
});
test('queued catalog edits retain their original version even if an earlier move observes a concurrent catalog edit',async()=>{
 let view=driveSnapshot(state(),ctx.upcoming,ctx),release,secondVersion;
 const queue=new MenuMutations(()=>view,s=>view=s,()=>{});
 const p1=queue.enqueue({type:'move',saturday:ctx.upcoming,meal:'friday',index:0,toIndex:1},()=>new Promise(r=>release=r));
 const p2=queue.enqueue({type:'catalog_save',saturday:ctx.upcoming,dish:{name:'סלט משותף',category:'salad'}},async(_,catalogRevision)=>{secondVersion=catalogRevision;throw Error('catalog conflict');});
 const done=Promise.allSettled([p1,p2]);release({...view,catalog_revision:8});await done;
 assert.equal(secondVersion,0,'never rebase a queued edit over another family member without review');assert.equal(view.catalog_revision,8);
});
test('preparation assignment, reassignment and clearing persist without changing the dish catalog or old history',()=>{
 let s=state();const catalog=structuredClone(s.dish_catalog),history=structuredClone(s.history);
 const first=driveAction(s,action(s,{type:'assign',meal:'friday',index:0,responsible:'אבא'}),'נעה',ctx);s=first.state;
 assert.equal(first.response.snapshot.current.friday.dishes[0].prepared_by,'אבא');assert.deepEqual(s.dish_catalog,catalog);assert.deepEqual(s.history,history);
 const originalName=s.menu_drafts[ctx.upcoming].friday.dishes[0].name;
 s=driveAction(s,action(s,{type:'move',meal:'friday',index:0,toIndex:1}),'נעה',ctx).state;
 assert.equal(s.menu_drafts[ctx.upcoming].friday.dishes[1].name,originalName);assert.equal(s.menu_drafts[ctx.upcoming].friday.dishes[1].prepared_by,'אבא');
 s=driveAction(s,action(s,{type:'replace',meal:'friday',index:1,dish:{name:'מרק אחר',category:'soup'}}),'נעה',ctx).state;
 assert.equal(s.menu_drafts[ctx.upcoming].friday.dishes[1].prepared_by,'אבא');
 s=driveAction(s,action(s,{type:'assign',meal:'friday',index:1,responsible:'אמא'}),'נעה',ctx).state;
 assert.equal(s.menu_drafts[ctx.upcoming].friday.dishes[1].prepared_by,'אמא');
 s=driveAction(s,action(s,{type:'assign',meal:'friday',index:1,responsible:''}),'נעה',ctx).state;
 assert.equal(s.menu_drafts[ctx.upcoming].friday.dishes[1].prepared_by,undefined);
 assert.throws(()=>driveAction(s,action(s,{type:'assign',meal:'friday',index:1,responsible:'unknown'}),'נעה',ctx));
 assert.throws(()=>driveAction(s,{...action(s,{type:'assign',meal:'friday',index:1,responsible:'אבא'}),revision:0},'נעה',ctx),e=>e.status===409);
});
test('preparation choice is optimistic and one completed assignment causes one Drive write',async()=>{
 const s=state(),h=harness(s),a=action(s,{type:'assign',meal:'friday',index:0,responsible:'יפעת',mutationId:'preparation-12345'});
 let view=driveSnapshot(s,ctx.upcoming,ctx),release;
 const queue=new MenuMutations(()=>view,p=>view=p,()=>{});
 const p=queue.enqueue(a,()=>new Promise(r=>release=r));assert.equal(view.current.friday.dishes[0].prepared_by,'יפעת');
 const response=h.post(a);release(response.snapshot);await p;assert.equal(h.counts.writes,1);
 h.post(a);assert.equal(h.counts.writes,1);assert.equal(h.live().menu_drafts[ctx.upcoming].friday.dishes[0].prepared_by,'יפעת');
});
test('transfer between meals is atomic, preserves preparation, and rejects stale or incompatible destinations',()=>{
 let s=state();s.menu_drafts[ctx.upcoming].friday.dishes[0]={name:'מרק מיוחד להעברה',category:'soup',prepared_by:'אבא',updated_by:'נעה'};
 const h=harness(s),a=action(s,{type:'transfer',meal:'friday',index:0,targetSaturday:ctx.upcoming,targetMeal:'lunch',mutationId:'transfer-12345'});
 const result=h.post(a);assert.ok(result.snapshot);assert.equal(h.counts.writes,1);
 const menu=h.live().menu_drafts[ctx.upcoming];assert.equal(menu.friday.dishes.some(d=>d?.name==='מרק מיוחד להעברה'),false);assert.equal(menu.lunch.dishes.find(d=>d?.name==='מרק מיוחד להעברה').prepared_by,'אבא');
 assert.equal(h.post({...a,mutationId:'transfer-98765'}).http_status,409);assert.equal(h.counts.writes,1);
 s=state();s.menu_drafts[ctx.upcoming].friday.dishes[0]={name:'לזניה גבינה',category:'pasta'};const original=structuredClone(s);
 assert.throws(()=>driveAction(s,action(s,{type:'transfer',meal:'friday',index:0,targetSaturday:'2026-10-31',targetMeal:'lunch'}),'נעה',ctx));assert.deepEqual(s,original);
});
test('transfer to next Shabbat creates its menu once, keeps all unrelated target dishes, and never removes source on failure',()=>{
 let s=state();s.menu_drafts[ctx.upcoming].friday.dishes[0]={name:'מרק מיוחד להעברה',category:'soup',updated_by:'נעה'};
 const a=action(s,{type:'transfer',meal:'friday',index:0,targetSaturday:'2026-10-31',targetMeal:'friday'});
 const moved=driveAction(s,a,'נעה',ctx);assert.ok(moved.state.menu_drafts['2026-10-31']);assert.ok(moved.state.menu_drafts['2026-10-31'].friday.dishes.some(d=>d?.name==='מרק מיוחד להעברה'));
 assert.equal(moved.state.menu_revisions['2026-10-31'],1);assert.equal(s.menu_drafts[ctx.upcoming].friday.dishes[0].name,'מרק מיוחד להעברה');
 assert.throws(()=>driveAction(s,{...a,targetSaturday:'2026-11-07'},'נעה',ctx));
 const duplicate=structuredClone(s);duplicate.menu_drafts[ctx.upcoming].lunch.dishes.push({name:'מרק מיוחד להעברה',category:'soup'});assert.throws(()=>driveAction(duplicate,{...a,targetSaturday:ctx.upcoming,targetMeal:'lunch'},'נעה',ctx));assert.equal(duplicate.menu_drafts[ctx.upcoming].friday.dishes[0].name,'מרק מיוחד להעברה');
});
test('unlike clears only the actor like while preserving views, other likes and approved history',()=>{
 let s=state();for(const k of ['friday','lunch'])s.menu_drafts[ctx.upcoming][k].dishes=s.menu_drafts[ctx.upcoming][k].dishes.filter(Boolean);
 s=driveAction(s,action(s,{type:'family_approve'}),'נעה',ctx).state;s=driveAction(s,action(s,{type:'family_approve'}),'אבא',ctx).state;const history=structuredClone(s.history);
 s=driveAction(s,action(s,{type:'family_unapprove'}),'נעה',ctx).state;
 assert.equal(s.family_status['נעה'].approved_revision,-1);assert.equal(s.family_status['נעה'].seen_revision,s.menu_revisions[ctx.upcoming]);assert.equal(s.family_status['אבא'].approved_revision,s.menu_revisions[ctx.upcoming]);assert.deepEqual(s.history,history);
});
test('end-of-Shabbat archives preserve exact menu authors, preparation and status and never overwrite an existing final copy',()=>{
 const s=state();s.menu_drafts[ctx.upcoming].friday.dishes[0]={name:'מרק מתועד',category:'soup',updated_by:'אביגיל',prepared_by:'אמא'};markDriveSeen(s,'אבא',ctx.upcoming,ctx);
 const sunday={upcoming:'2026-10-31',now:'2026-10-24T21:15:00Z',today:'2026-10-25'};
 const closed=driveAction(s,{type:'archive_completed',saturday:'2026-10-31',compact:true},'נעה',sunday);
 const archive=closed.state.shabbat_archive[ctx.upcoming];assert.equal(archive.menu.friday.dishes[0].updated_by,'אביגיל');assert.equal(archive.menu.friday.dishes[0].prepared_by,'אמא');assert.equal(archive.family_status[0].name,'אבא');
 closed.state.menu_drafts[ctx.upcoming].friday.dishes[0].name='עריכה מאוחרת';
 const repeated=driveAction(closed.state,{type:'archive_completed',saturday:'2026-10-31',compact:true},'נעה',sunday);
 assert.equal(repeated.changed,false);assert.equal(repeated.state.shabbat_archive[ctx.upcoming].menu.friday.dishes[0].name,'מרק מתועד');assert.deepEqual(s.shabbat_archive,undefined);
});

test('one completed editor save atomically stores replacement and preparation; replay never writes twice',()=>{
 const s=state(),h=harness(s),a=action(s,{type:'replace',meal:'friday',index:0,dish:{name:'מרק עריכה משותפת',category:'soup'},responsible:'יפעת',mutationId:'editor-combined-12345'});
 const result=h.post(a);assert.ok(result.snapshot);assert.equal(h.counts.writes,1);
 assert.equal(result.snapshot.current.friday.dishes[0].prepared_by,'יפעת');
 assert.equal(h.live().dish_catalog.find(d=>d.name===a.dish.name).prepared_by,undefined,'assignment belongs to the meal, not catalog');
 assert.equal(h.post(a).snapshot.revision,result.snapshot.revision);assert.equal(h.counts.writes,1);
 const stale=h.post({...a,actor:'אבא',mutationId:'editor-conflict-12345',responsible:'אבא'});assert.equal(stale.http_status,409);assert.equal(h.counts.writes,1);
});
test('new dish preparation survives automatic placement and combined clearing; invalid preparation saves neither field',()=>{
 let s=state();const add=driveAction(s,action(s,{type:'add',meal:'friday',dish:{name:'מרק חדש משובץ',category:'soup'},responsible:'אבא'}),'נעה',ctx);s=add.state;
 assert.equal(add.response.snapshot.current.friday.dishes.find(d=>d?.name==='מרק חדש משובץ').prepared_by,'אבא');
 const index=s.menu_drafts[ctx.upcoming].friday.dishes.findIndex(d=>d?.name==='מרק חדש משובץ');
 const clear=driveAction(s,action(s,{type:'replace',meal:'friday',index,dish:{name:'מרק החלפה',category:'soup'},responsible:''}),'נעה',ctx);assert.equal(clear.response.snapshot.current.friday.dishes[index].prepared_by,undefined);
 const original=structuredClone(s),h=harness(s),bad=h.post(action(s,{type:'replace',meal:'friday',index,dish:{name:'מרק לא נשמר',category:'soup'},responsible:'unknown'}));
 assert.ok(bad.http_status);assert.equal(h.counts.writes,0);assert.deepEqual(h.live(),original);
});

test('recipe-only save uses one Drive write, replay uses none, and invalid link writes nothing',()=>{
 const s=state(),h=harness(s);const dish=s.menu_drafts[ctx.upcoming].friday.dishes.find(Boolean),index=s.menu_drafts[ctx.upcoming].friday.dishes.indexOf(dish);
 const a=action(s,{type:'replace',meal:'friday',index,dish:{...dish,recipe_url:'https://example.com/recipe'},mutationId:'recipe-once-12345'});
 const result=h.post(a);assert.equal(result.snapshot.current.friday.dishes[index].recipe_url,'https://example.com/recipe');assert.equal(h.counts.writes,1);
 assert.equal(h.post(a).snapshot.current.friday.dishes[index].recipe_url,'https://example.com/recipe');assert.equal(h.counts.writes,1);
 const current=h.live();const invalid=h.post(action(current,{type:'replace',meal:'friday',index,dish:{...dish,recipe_url:'javascript:alert(1)'}}));assert.ok(invalid.http_status>=400);assert.equal(h.counts.writes,1);assert.equal(h.live().dish_catalog.find(d=>d.name===dish.name).recipe_url,'https://example.com/recipe');
});
