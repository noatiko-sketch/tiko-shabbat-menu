import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clearWeeklyBought,shoppingAction} from '../lib/shopping.ts';
const fixture=()=>({menu_drafts:{keep:true},shopping:{revision:4,products:[{id:'a'},{id:'b'}],receipts:[{id:'old',actor:'אבא'}],items:[{productId:'a',bought:true,updated_at:'2026-11-06T10:00:00Z'},{productId:'b',bought:false,quantity:'2',updated_at:'2026-11-06T10:00:00Z'}]}});
test('Saturday noon Jerusalem removes only bought items, preserving catalog, receipts and menus',()=>{
 const s=fixture(),before=structuredClone(s);
 clearWeeklyBought(s,'2026-11-07T09:59:59Z');assert.deepEqual(s.shopping,before.shopping);
 assert.equal(clearWeeklyBought(s,'2026-11-07T10:00:00Z'),true);
 assert.deepEqual(s.shopping.items,[before.shopping.items[1]]);assert.equal(s.shopping.revision,5);
 assert.deepEqual(s.shopping.products,before.shopping.products);assert.deepEqual(s.shopping.receipts,before.shopping.receipts);assert.deepEqual(s.menu_drafts,before.menu_drafts);
 assert.equal(clearWeeklyBought(s,'2026-11-07T10:01:00Z'),false);
 assert.throws(()=>shoppingAction(s,{type:'shopping_clear_bought',mutationId:'stale-action',revision:4},'אבא','2026-11-07T10:01:00Z'),e=>e.status===409);
});
test('late cleanup preserves purchases after the cutoff and clears them next Saturday',()=>{
 const s=fixture();s.shopping.items.push({productId:'c',bought:true,updated_at:'2026-11-07T10:00:00Z'});
 clearWeeklyBought(s,'2026-11-09T10:00:00Z');assert.deepEqual(s.shopping.items.map(i=>i.productId),['b','c']);
 clearWeeklyBought(s,'2026-11-14T10:00:00Z');assert.deepEqual(s.shopping.items.map(i=>i.productId),['b']);
});
test('summer noon and weeks spanning both DST changes use Jerusalem time',()=>{
 for(const [date,hour] of [['2026-07-04',9],['2026-03-28',9],['2026-10-31',10]]){
  const s=fixture();s.shopping.items[0].updated_at=date+'T00:00:00Z';
  clearWeeklyBought(s,`${date}T${String(hour-1).padStart(2,'0')}:59:59Z`);assert.equal(s.shopping.items.length,2);
  clearWeeklyBought(s,`${date}T${String(hour).padStart(2,'0')}:00:00Z`);assert.equal(s.shopping.items.length,1);
 }
});
test('absent shopping is untouched; unknown timestamps are retained safely',()=>{
 const empty={other:true};assert.equal(clearWeeklyBought(empty,'2026-11-07T10:00:00Z'),false);assert.deepEqual(empty,{other:true});
 const s=fixture();s.shopping.items[0].updated_at='invalid';clearWeeklyBought(s,'2026-11-07T10:00:00Z');assert.equal(s.shopping.items.length,2);assert.equal(s.shopping.revision,4);
});

import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('Google snapshot and timer persist cleanup under lock; setup is owner-only and idempotent',()=>{
 let live=fixture(),held=false,writes=0,created=0;
 const RealDate=Date;
 class Clock extends RealDate {constructor(...args){super(...(args.length?args:['2026-11-07T10:00:00Z']));}}
 const triggers=[];let active='owner';
 const sandbox={Date:Clock,Session:{getActiveUser:()=>({getEmail:()=>active}),getEffectiveUser:()=>({getEmail:()=> 'owner'})},
  ScriptApp:{getProjectTriggers:()=>triggers,newTrigger:name=>({timeBased:()=>({everyMinutes:n=>({create:()=>{assert.equal(n,1);created++;triggers.push({getHandlerFunction:()=>name});}})})})},
  DriveApp:{getFileById:()=>({getBlob:()=>({getDataAsString:()=>JSON.stringify(live)}),setContent:text=>{assert.equal(held,true);writes++;live=JSON.parse(text);}})},
  LockService:{getScriptLock:()=>({tryLock:()=>{assert.equal(held,false);held=true;return true;},releaseLock:()=>{held=false;}})}};
 vm.runInNewContext(readFileSync(new URL('../google/Code.gs',import.meta.url),'utf8'),sandbox);
 const snap=sandbox.shoppingRequest_({type:'shopping_snapshot',actor:'אבא'});
 assert.equal(snap.shopping.items.length,1);assert.equal(writes,1);assert.equal(live.shopping.revision,5);
 sandbox.clearWeeklyBought_();assert.equal(writes,1);
 assert.throws(()=>sandbox.shoppingRequest_({type:'shopping_clear_bought',actor:'אבא',mutationId:'stale-operation',revision:4}),e=>e.status===409);
 sandbox.setupWeeklyShoppingCleanup();sandbox.setupWeeklyShoppingCleanup();assert.equal(created,1);assert.equal(writes,1);
 active='other';assert.throws(()=>sandbox.setupWeeklyShoppingCleanup());
});
