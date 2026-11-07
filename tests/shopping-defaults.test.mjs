import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaultShoppingChoices} from '../lib/shopping-defaults.ts';
import {readShopping,editShopping,shoppingAction,shoppingSnapshot} from '../lib/shopping.ts';
import {confirmShoppingAddition} from '../lib/shopping-addition.ts';
import {ShoppingMutations} from '../lib/shopping-mutations.ts';
const now='2026-11-07T18:00:00Z';
const edit=(s,a)=>editShopping(s,{mutationId:'defaults-test-123',...a},'נעה',now);
const choices=s=>defaultShoppingChoices(s.products,s.defaultProductIds);
test('legacy inferred defaults reset empty while all products and shopping items survive',()=>{
 const s=edit(readShopping({}),{type:'shopping_add',name:'חלב',category:'dairy',quantity:'2'});
 s.hiddenDefaults=['חלב'];const before=structuredClone(s);
 assert.deepEqual(choices(s),[]);assert.deepEqual(s,before);
 assert.deepEqual(choices(readShopping({shopping:JSON.parse(JSON.stringify(s))})),[]);
});
test('only explicit saves create membership; remove and restore persist without changing active shopping',()=>{
 let s=edit(readShopping({}),{type:'shopping_add',name:'מפיות',category:'cleaning'});
 const active=structuredClone(s.items);assert.equal(choices(s).length,0);
 s=edit(s,{type:'shopping_default_save',name:'מפיות',category:'cleaning'});
 assert.deepEqual(s.items,active);assert.equal(choices(s).length,1);
 s=edit(s,{type:'shopping_default_remove',name:'  מפיות '});assert.equal(choices(s).length,0);assert.deepEqual(s.items,active);
 s=readShopping({shopping:JSON.parse(JSON.stringify(s))});assert.equal(choices(s).length,0);
 s=edit(s,{type:'shopping_default_save',name:'מפיות',category:'general'});
 s=edit(s,{type:'shopping_default_save',name:'מפיות',category:'general'});
 assert.equal(s.products.length,1);assert.equal(s.defaultProductIds.length,1);assert.equal(choices(s)[0].category,'general');
});
test('new default saves do not add active items; categories follow the catalog',()=>{
 let s=edit(readShopping({}),{type:'shopping_default_save',name:'עגבניות',category:'produce'});
 s=edit(s,{type:'shopping_default_save',name:'חלב',category:'dairy',mutationId:'second-default-123'});
 assert.equal(s.items.length,0);assert.equal(choices(s).length,2);
 const grouped=Object.groupBy(choices(s),p=>p.category);assert.equal(grouped.produce[0].name,'עגבניות');assert.equal(grouped.dairy[0].name,'חלב');
 s=edit(s,{type:'shopping_recategorize',productId:grouped.dairy[0].id,category:'general'});assert.equal(choices(s).find(p=>p.name==='חלב').category,'general');
});
test('default mutations validate inputs, revisions and idempotency',()=>{
 const original={shopping:readShopping({}),preserve:{menu:true}};
 const action={type:'shopping_default_save',mutationId:'create-default-123',revision:0,name:'מפיות',category:'cleaning'};
 const first=shoppingAction(original,action,'נעה',now);
 assert.equal(first.state.shopping.revision,1);assert.equal(first.state.shopping.items.length,0);assert.deepEqual(first.state.preserve,original.preserve);assert.equal(original.shopping.products.length,0);
 assert.equal(shoppingAction(first.state,action,'נעה',now).changed,false);
 assert.throws(()=>shoppingAction(first.state,{...action,mutationId:'stale-default-123'},'אמא',now),e=>e.status===409);
 for(const a of [{type:'shopping_default_save',name:'',category:'general'},{type:'shopping_default_save',name:'מפיות',category:'bad'},{type:'shopping_default_remove',name:'x'.repeat(101)}])assert.throws(()=>edit(original.shopping,a));
});
test('silent selected import ignores bought and pending duplicates, quantities and attribution intact',()=>{
 let s=edit(readShopping({}),{type:'shopping_add',name:'חלב',category:'dairy',quantity:'2'});
 s=edit(s,{type:'shopping_toggle',productId:s.products[0].id,bought:true});const original=structuredClone(s);
 const action={type:'shopping_import',skipExisting:true,items:[{name:'  חלב  ',category:'general',quantity:'9'},{name:'עגבניות',category:'produce',quantity:''},{name:'עגבניות',category:'produce',quantity:'20'}]};
 const approved=confirmShoppingAddition(s,action,()=>assert.fail('no duplicate alerts'));
 assert.equal(approved.items.length,1);
 const next=edit(s,action);assert.equal(next.items.length,2);assert.equal(next.items[1].quantity,'');assert.equal(next.revision,s.revision+1);assert.deepEqual(next.items[0],original.items[0]);assert.deepEqual(next.products[0],original.products[0]);assert.deepEqual(s,original);
 const allDuplicate={...action,items:[action.items[0]]};assert.equal(confirmShoppingAddition(s,allDuplicate,()=>assert.fail()),null);
 assert.deepEqual(edit(s,allDuplicate),s);
});
test('default changes show immediately and rollback on a failed shared write',async()=>{
 let view=shoppingSnapshot({}),reject;
 const before=structuredClone(view),queue=new ShoppingMutations(()=>view,s=>view=s,()=>{},'נעה');
 const p=queue.enqueue({type:'shopping_default_save',name:'חלב',category:'dairy',mutationId:'save-default-123'},()=>new Promise((_,r)=>reject=r));
 assert.equal(choices(view.shopping).length,1);
 const caught=assert.rejects(p,/offline/);reject(Error('offline'));await caught;assert.deepEqual(view,before);
});
