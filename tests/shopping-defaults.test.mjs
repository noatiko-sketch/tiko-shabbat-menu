import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaultShoppingChoices} from '../lib/shopping-defaults.ts';
import {readShopping,editShopping,shoppingAction,shoppingSnapshot} from '../lib/shopping.ts';
import {ShoppingMutations} from '../lib/shopping-mutations.ts';
const now='2026-11-07T18:00:00Z';
const edit=(s,a)=>editShopping(s,{mutationId:'defaults-test-123',...a},'נעה',now);
const choices=s=>defaultShoppingChoices(s.products,s.hiddenDefaults);
test('removing a built-in default persists across reloads and ordinary shopping additions',()=>{
 let s=edit(readShopping({}),{type:'shopping_default_remove',name:'  חלב  '});
 assert.ok(!choices(s).some(p=>p.name==='חלב'));assert.equal(s.products.length,0);assert.equal(s.items.length,0);
 s=readShopping({shopping:JSON.parse(JSON.stringify(s))});
 s=edit(s,{type:'shopping_add',name:'חלב',category:'dairy',quantity:'2'});
 assert.equal(s.items.length,1);assert.ok(!choices(s).some(p=>p.name==='חלב'));
 const active=structuredClone(s.items),products=structuredClone(s.products);
 s=edit(s,{type:'shopping_default_remove',name:'חלב'});
 assert.deepEqual(s.items,active);assert.deepEqual(s.products,products);assert.deepEqual(s.hiddenDefaults,['חלב']);
});
test('saving defaults adds no active items, restores hidden defaults, and remembers categories without duplicate products',()=>{
 let s=edit(readShopping({}),{type:'shopping_default_save',name:'מפיות',category:'cleaning'});
 assert.equal(s.items.length,0);assert.equal(choices(s).find(p=>p.name==='מפיות').category,'cleaning');
 s=edit(s,{type:'shopping_default_remove',name:'מפיות'});assert.ok(!choices(s).some(p=>p.name==='מפיות'));
 s=edit(s,{type:'shopping_default_save',name:'  מפיות ',category:'general'});
 assert.equal(s.products.length,1);assert.equal(choices(s).find(p=>p.name==='מפיות').category,'general');assert.deepEqual(s.hiddenDefaults,[]);
 const byCategory=Object.groupBy(choices(s),p=>p.category);assert.ok(byCategory.produce.some(p=>p.name==='עגבניות'));assert.ok(byCategory.general.some(p=>p.name==='מפיות'));
});
test('default mutations reject invalid inputs and use shared revisions and idempotency',()=>{
 const original={shopping:readShopping({}),preserve:{menu:true}};
 const action={type:'shopping_default_save',mutationId:'create-default-123',revision:0,name:'מפיות',category:'cleaning'};
 const first=shoppingAction(original,action,'נעה',now);
 assert.equal(first.state.shopping.revision,1);assert.equal(first.state.shopping.items.length,0);assert.deepEqual(first.state.preserve,original.preserve);assert.equal(original.shopping.products.length,0);
 assert.equal(shoppingAction(first.state,action,'נעה',now).changed,false);
 assert.throws(()=>shoppingAction(first.state,{...action,mutationId:'stale-default-123'},'אמא',now),e=>e.status===409);
 for(const a of [{type:'shopping_default_save',name:'',category:'general'},{type:'shopping_default_save',name:'מפיות',category:'bad'},{type:'shopping_default_remove',name:'x'.repeat(101)}])assert.throws(()=>edit(original.shopping,a));
});
test('default changes show immediately and rollback together on a failed shared write',async()=>{
 let view=shoppingSnapshot({}),reject;
 const before=structuredClone(view),queue=new ShoppingMutations(()=>view,s=>view=s,()=>{},'נעה');
 const p=queue.enqueue({type:'shopping_default_remove',name:'חלב',mutationId:'remove-default-123'},()=>new Promise((_,r)=>reject=r));
 assert.ok(!choices(view.shopping).some(p=>p.name==='חלב'));
 const caught=assert.rejects(p,/offline/);reject(Error('offline'));await caught;assert.deepEqual(view,before);
});
