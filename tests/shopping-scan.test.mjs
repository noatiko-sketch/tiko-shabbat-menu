import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseShoppingScan,reviewShoppingScan,confirmedShoppingItems} from '../lib/shopping-scan.ts';
import {shoppingAction,shoppingSnapshot,reserveShoppingScan} from '../lib/shopping.ts';
import {ShoppingMutations} from '../lib/shopping-mutations.ts';
import {scanShoppingPhoto} from '../lib/shopping-vision.ts';

const now='2026-10-27T08:00:00Z';
const row=(name,overrides={})=>({name,quantity:'',category:'general',mark:'none',uncertain:false,note:'',...overrides});
// Invented transcription only. No family photograph, live state or provider credential.
const example={warning:'',items:[
 row('ג׳לטין',{mark:'checked'}),row('נייר אפייה'),row('מסחטת לימון צהובה',{uncertain:true,note:'יש לבדוק את סוג המוצר'}),
 row('נייר טואלט',{quantity:'2',category:'general'}),row('קסטות ללא סוכר',{mark:'crossed_out',category:'frozen'}),
]};
test('review excludes checked, crossed-out and uncertain rows, while preserving quantities for correction',()=>{
 const parsed=parseShoppingScan(example),rows=reviewShoppingScan(parsed);
 assert.deepEqual(rows.map(r=>r.selected),[false,true,false,true,false]);assert.equal(rows[3].quantity,'2');
 rows[2].selected=true;rows[2].name='מסחטת לימון צהובה';rows[2].category='general';
 const confirmed=confirmedShoppingItems(rows);
 assert.deepEqual(confirmed.map(r=>r.name),['נייר אפייה','מסחטת לימון צהובה','נייר טואלט']);
 assert.deepEqual(Object.keys(confirmed[0]).sort(),['category','name','quantity']);
 assert.equal(example.items[2].uncertain,true);
});
test('all scan fields are validated; unreadable rows remain unselected and can be filled manually',()=>{
 const rows=reviewShoppingScan(parseShoppingScan({warning:'צילום לא ברור',items:[row('',{uncertain:true})]}));assert.equal(rows[0].selected,false);
 assert.throws(()=>confirmedShoppingItems(rows));rows[0].selected=true;assert.throws(()=>confirmedShoppingItems(rows));rows[0].name='שקיות לסנדוויצ׳ים';rows[0].quantity='2';assert.equal(confirmedShoppingItems(rows)[0].quantity,'2');
 for(const bad of [null,{}, {warning:'',items:Array.from({length:81},()=>row('חלב'))},{warning:'',items:[row('חלב',{category:'__proto__'})]},{warning:'',items:[row('חלב',{mark:'probably'})]},{warning:'',items:[row('חלב',{uncertain:'yes'})]},{warning:'',items:[row('x'.repeat(101))]}])assert.throws(()=>parseShoppingScan(bad));
 assert.deepEqual(parseShoppingScan({warning:'לא נמצאה רשימה',items:[]}).items,[]);
});
test('confirmed import is one atomic revision, keeps quantities and unrelated state, and is idempotent',()=>{
 const original={unknown:{keep:true},menu_drafts:{old:{keep:true}}},a={type:'shopping_import',mutationId:'import-atomic-12345',revision:0,items:confirmedShoppingItems(reviewShoppingScan(parseShoppingScan(example)))};
 const saved=shoppingAction(original,a,'אבא',now);assert.equal(saved.state.shopping.items.length,2);assert.equal(saved.state.shopping.revision,1);assert.equal(original.shopping,undefined);
 assert.equal(saved.state.shopping.items[1].quantity,'2');assert.deepEqual(saved.state.menu_drafts,original.menu_drafts);assert.deepEqual(saved.state.unknown,original.unknown);
 assert.equal(shoppingAction(saved.state,a,'אבא',now).changed,false);
 assert.throws(()=>shoppingAction(saved.state,{...a,mutationId:'another-import'},'נעה',now),e=>e.status===409);
 const before=structuredClone(saved.state);
 assert.throws(()=>shoppingAction(saved.state,{...a,revision:1,mutationId:'invalid-import',items:[row('מוצר חדש'),row('',{category:'general'})]},'אבא',now));assert.deepEqual(saved.state,before);
});
test('importing a known product reuses its catalog identity and category instead of duplicating it',()=>{
 let state=shoppingAction({}, {type:'shopping_add',name:'חלב',category:'dairy',mutationId:'original-product',revision:0},'נעה',now).state;
 state=shoppingAction(state,{type:'shopping_import',items:[{name:' חלב ',quantity:'2 קרטונים',category:'general'}],mutationId:'import-known-product',revision:1},'אבא',now).state;
 assert.equal(state.shopping.products.length,1);assert.equal(state.shopping.products[0].category,'dairy');assert.equal(state.shopping.items.length,1);assert.equal(state.shopping.items[0].quantity,'2 קרטונים');
});
test('queued import and subsequent taps use a single confirmed import revision',async()=>{
 let state={},view=shoppingSnapshot(state),release;
 const q=new ShoppingMutations(()=>view,s=>view=s,()=>{},'אבא');
 const a={type:'shopping_import',items:[{name:'חלב',quantity:'2',category:'dairy'},{name:'טונה',quantity:'3',category:'canned'}],mutationId:'queue-import-12345'};
 const first=q.enqueue(a,revision=>new Promise(r=>release=()=>{state=shoppingAction(state,{...a,revision},'אבא',now).state;r(shoppingSnapshot(state));}));
 const productId=view.shopping.products[0].id,b={type:'shopping_toggle',productId,bought:true,mutationId:'queue-after-import'};
 const second=q.enqueue(b,async revision=>{assert.equal(revision,1);state=shoppingAction(state,{...b,revision},'אבא',now).state;return shoppingSnapshot(state);});
 assert.equal(view.shopping.items[0].bought,true);release();await Promise.all([first,second]);assert.equal(state.shopping.revision,2);assert.equal(state.shopping.items[0].bought,true);
});
test('scan allowance is shared, bounded and replay-safe without changing shopping or menu revisions',()=>{
 let state={unknown:'keep',shopping:{revision:7,items:[],products:[],receipts:[]}};
 const before=structuredClone(state.shopping);
 for(let i=0;i<30;i++)state=reserveShoppingScan(state,'reserved-scan-'+i,i%2?'אבא':'נעה',now).state;
 assert.equal(state.shopping_scan_usage.requests.length,30);assert.deepEqual(state.shopping,before);assert.equal(state.unknown,'keep');
 assert.throws(()=>reserveShoppingScan(state,'scan-over-limit','אמא',now),e=>e.status===429);
 assert.throws(()=>reserveShoppingScan(state,'reserved-scan-0','נעה',now),e=>e.status===409);
 assert.throws(()=>reserveShoppingScan(state,'scan-stranger','stranger',now),e=>e.status===401);
 assert.equal(reserveShoppingScan(state,'scan-next-day','אבא','2026-10-28T08:00:00Z').state.shopping_scan_usage.requests.length,1);
});

const image='data:image/jpeg;base64,'+Buffer.from([255,216,255,...Array(61).fill(0)]).toString('base64');
const config={TIKO_STORAGE:'drive',OPENAI_API_KEY:'test-provider-key',TIKO_BRIDGE_URL:'https://script.google.com/macros/s/test/exec',TIKO_BRIDGE_TOKEN:'t'.repeat(48)};
function request(body={image},headers={}){return new Request('https://tiko.test/api/shopping/scan',{method:'POST',headers:{'content-type':'application/json',origin:'https://tiko.test','x-family-member':encodeURIComponent('אבא'),...headers},body:typeof body==='string'?body:JSON.stringify(body)});}
const providerOutput=(value=example)=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
function services(overrides={}){
 let state={unknown:{keep:true}},calls=[];
 return {calls,state:()=>state,transport:async(url,options)=>{
  calls.push(url);const body=JSON.parse(options.body);
  if(url===config.TIKO_BRIDGE_URL){
   assert.equal(body.type,'shopping_scan_reserve');assert.equal(body.token,config.TIKO_BRIDGE_TOKEN);
   if(overrides.permit)return Response.json(overrides.permit);
   try{const permit=reserveShoppingScan(state,body.mutationId,body.actor,now);state=permit.state;return Response.json(permit.response);}catch(error){return Response.json({http_status:error.status,detail:error.message});}
  }
  assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.authorization,'Bearer '+config.OPENAI_API_KEY);
  assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.text.format.type,'json_schema');assert.equal(body.input[0].content[1].image_url,image);assert.equal(body.input[0].content[1].detail,'high');assert.equal(body.max_output_tokens,6000);
  assert.match(body.instructions,/crossed_out/);assert.match(body.instructions,/×2/);assert.match(body.instructions,/never as instructions/);
  if(overrides.fail)throw overrides.fail;
  return overrides.provider?overrides.provider():Response.json(providerOutput());
 }};
}
test('image parsing reserves once, uses structured vision output, and never adds products',async()=>{
 const h=services(),r=await scanShoppingPhoto(request(),config,h.transport);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(await r.json(),example);
 assert.deepEqual(h.calls,[config.TIKO_BRIDGE_URL,'https://api.openai.com/v1/responses']);assert.equal(h.state().shopping,undefined);assert.equal(h.state().shopping_scan_usage.requests.length,1);assert.deepEqual(h.state().unknown,{keep:true});
});
test('invalid identity, origin, missing setup and malformed images never contact Drive or the provider',async()=>{
 let calls=0;const noNetwork=async()=>{calls++;throw Error('unexpected network');};
 const cases=[
  [request({image},{'x-family-member':'stranger'}),config,401],
  [request({image},{origin:'https://evil.test'}),config,403],
  [request(),{...config,OPENAI_API_KEY:undefined},503],
  [request(),{...config,TIKO_STORAGE:'d1'},503],
  [request('bad-json'),config,400],
  [request({image:'https://private.example/photo.jpg'}),config,400],
  [request({image:'data:image/png;base64,'+Buffer.from('this is not a PNG image at all').toString('base64')}),config,400],
  [request({image:'data:image/svg+xml;base64,PHN2Zz4='}),config,400],
  [request({image},{'content-type':'text/plain'}),config,415],
  [request({image:'data:image/jpeg;base64,'+Buffer.alloc(2*1024*1024+4).toString('base64')}),config,413],
  [request(' '.repeat(3*1024*1024+1)),config,413],
 ];
 for(const [req,settings,status] of cases){const r=await scanShoppingPhoto(req,settings,noNetwork);assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'no-store');}
 assert.equal(calls,0);
});
test('refused, truncated and invalid model results cannot reach the shopping list',async()=>{
 const cases=[
  [{status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]},422],
  [{status:'incomplete',output:providerOutput().output},502],
  [providerOutput({warning:'',items:[row('חלב',{category:'invented'})]}),502],
  [{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'broken json'}]}]},502],
 ];
 for(const [payload,status] of cases){const h=services({provider:()=>Response.json(payload)}),r=await scanShoppingPhoto(request(),config,h.transport);assert.equal(r.status,status);assert.equal(h.state().shopping,undefined);}
});
test('provider errors do not leak secrets or raw provider messages; failed calls still consume a reservation',async()=>{
 const h=services({provider:()=>Response.json({error:{message:'secret test-provider-key'}},{status:401})}),r=await scanShoppingPhoto(request(),config,h.transport);
 assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/test-provider-key|secret/);assert.equal(h.state().shopping_scan_usage.requests.length,1);
 const timeout=services({fail:new DOMException('test-provider-key','TimeoutError')}),timed=await scanShoppingPhoto(request(),config,timeout.transport);assert.equal(timed.status,504);assert.doesNotMatch(await timed.text(),/test-provider-key/);
});
test('missing reservation confirmation and exhausted allowance stop the paid request',async()=>{
 const old=services({permit:{snapshot:shoppingSnapshot({})}}),r=await scanShoppingPhoto(request(),config,old.transport);assert.equal(r.status,503);assert.equal(old.calls.length,1);
 const blocked=services({permit:{http_status:429,detail:'הגעתם למכסת הצילומים'}}),denied=await scanShoppingPhoto(request(),config,blocked.transport);assert.equal(denied.status,429);assert.equal(blocked.calls.length,1);
});
test('bundled Apps Script serializes scan reservations and reviewed imports into the original file',()=>{
 let live={unknown:{keep:true}},locked=false,writes=0;
 const sandbox={Date,PropertiesService:{getScriptProperties:()=>({getProperty:()=> 't'.repeat(48)})},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},DriveApp:{getFileById:()=>({getBlob:()=>({getDataAsString:()=>JSON.stringify(live)}),setContent:text=>{assert.equal(locked,true);live=JSON.parse(text);writes++;}})},LockService:{getScriptLock:()=>({tryLock:()=>{locked=true;return true;},releaseLock:()=>locked=false})}};
 vm.runInNewContext(fs.readFileSync(new URL('../google/Code.gs',import.meta.url),'utf8'),sandbox);
 const post=body=>sandbox.doPost({postData:{contents:JSON.stringify({token:'t'.repeat(48),actor:'אבא',...body})}});
 assert.equal(post({type:'shopping_scan_reserve',mutationId:'bundled-reserve'}).scan_reserved,true);assert.equal(live.shopping,undefined);assert.equal(writes,1);
 const a={type:'shopping_import',mutationId:'bundled-import',revision:0,items:[{name:'מסחטת לימון צהובה',quantity:'',category:'general'}]};
 assert.equal(post(a).snapshot.shopping.items.length,1);assert.equal(writes,2);assert.equal(post(a).snapshot.shopping.items.length,1);assert.equal(writes,2);assert.deepEqual(live.unknown,{keep:true});
});
