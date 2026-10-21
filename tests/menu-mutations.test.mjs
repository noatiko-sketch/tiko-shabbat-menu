import assert from 'node:assert/strict';
import {test} from 'node:test';
import {MenuMutations} from '../lib/menu-mutations.ts';
import {editMenu} from '../lib/menu-model.ts';
const seed=()=>({revision:10,current:{saturday:'2026-10-24',week:2,friday:{date:'2026-10-23',dishes:['מרק','סלט','עוגה'].map(name=>({name,category:'extra'})),slot_categories:['soup','salad','dessert']},lunch:{date:'2026-10-24',dishes:[]}}});
const move=(index,toIndex)=>({type:'move',saturday:'2026-10-24',meal:'friday',index,toIndex});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const names=s=>s.current.friday.dishes.map(d=>d.name);
const saved=(s,a)=>({...s,current:editMenu(s.current,a),revision:s.revision+1});
function setup(){let view=seed(),status;const queue=new MenuMutations(()=>view,s=>view=s,(saving,blocking)=>status={saving,blocking});return {queue,view:()=>view,status:()=>status};}
test('drop renders immediately without blocking controls while Drive is slow',async()=>{
 const {queue,view,status}=setup(),remote=deferred(),action=move(0,2);
 const result=queue.enqueue(action,revision=>{assert.equal(revision,10);return remote.promise;});
 assert.deepEqual(names(view()),['סלט','עוגה','מרק']);assert.deepEqual(status(),{saving:true,blocking:false});
 assert.deepEqual(view().current.friday.slot_categories,['salad','dessert','soup']);
 remote.resolve(saved(seed(),action));assert.equal(await result,true);assert.equal(view().revision,11);assert.deepEqual(status(),{saving:false,blocking:false});
});
test('consecutive drops are visible together, sent serially with confirmed revisions',async()=>{
 const {queue,view}=setup(),first=deferred(),second=deferred(),calls=[];
 const a=move(0,2),b=move(0,1);
 const p1=queue.enqueue(a,r=>{calls.push(r);return first.promise;});
 const p2=queue.enqueue(b,r=>{calls.push(r);return second.promise;});
 assert.deepEqual(names(view()),['עוגה','סלט','מרק']);assert.deepEqual(calls,[10]);
 const state1=saved(seed(),a);first.resolve(state1);await p1;
 assert.deepEqual(calls,[10,11]);assert.deepEqual(names(view()),['עוגה','סלט','מרק']);
 second.resolve(saved(state1,b));await p2;assert.equal(view().revision,12);
});
test('a conflicting or failed write rolls back and cancels dependent index actions',async()=>{
 const {queue,view,status}=setup(),remote=deferred();let secondSent=false;
 const p1=queue.enqueue(move(0,2),()=>remote.promise);
 const p2=queue.enqueue(move(0,1),async()=>{secondSent=true;return seed();});
 const results=Promise.allSettled([p1,p2]);remote.reject(Error('conflict'));
 assert.deepEqual((await results).map(r=>r.status),['rejected','rejected']);
 assert.equal(secondSent,false);assert.deepEqual(names(view()),names(seed()));assert.deepEqual(status(),{saving:false,blocking:false});
 // A subsequent retry uses the refreshed canonical state rather than stale optimistic indices.
 const retry=queue.enqueue(move(0,1),async r=>{assert.equal(r,10);return saved(seed(),move(0,1));});
 assert.equal(await retry,true);
});
test('editing while a move saves queues the edit after the correct persisted order',async()=>{
 const {queue,view,status}=setup(),remote=deferred(),a=move(0,2);
 const p1=queue.enqueue(a,()=>remote.promise);
 const replacement={type:'replace',saturday:'2026-10-24',meal:'friday',index:0,dish:{name:'סלט חדש',category:'salad'}};
 const p2=queue.enqueue(replacement,async revision=>{assert.equal(revision,11);return saved(saved(seed(),a),replacement);});
 assert.deepEqual(status(),{saving:true,blocking:false});remote.resolve(saved(seed(),a));await Promise.all([p1,p2]);
 assert.deepEqual(names(view()),['סלט חדש','עוגה','מרק']);assert.deepEqual(status(),{saving:false,blocking:false});
});
