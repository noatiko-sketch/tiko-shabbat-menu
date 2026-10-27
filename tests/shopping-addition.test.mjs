import assert from 'node:assert/strict';
import {test} from 'node:test';
import {confirmShoppingAddition} from '../lib/shopping-addition.ts';
import {editShopping,readShopping} from '../lib/shopping.ts';
const now='2026-10-27T10:00:00Z';
const add={type:'shopping_add',name:'חלב',category:'dairy',quantity:'2'};
const state=()=>editShopping(readShopping({}),{...add,mutationId:'initial-milk'},'אבא',now);
test('manual duplicate cancellation preserves quantities and bought state; normalized names match',()=>{
 const s=state();s.items[0].bought=true;const before=structuredClone(s);let calls=0;
 assert.equal(confirmShoppingAddition(s,{...add,name:'  חלב  ',quantity:'3'},message=>{calls++;assert.match(message,/כבר ברשימה/);assert.match(message,/סומן כנקנה/);assert.match(message,/הכמות ברשימה: 2/);assert.match(message,/תעודכן ל: 3/);return false;}),null);
 assert.equal(calls,1);assert.deepEqual(s,before);
});
test('approval preserves one identity, updates quantity and returns a bought item to remaining',()=>{
 const s=state();s.items[0].bought=true;
 const approved=confirmShoppingAddition(s,{...add,quantity:'3'},()=>true);
 const next=editShopping(s,{...approved,mutationId:'approved-add'},'אבא',now);
 assert.equal(next.items.length,1);assert.equal(next.items[0].quantity,'3');assert.equal(next.items[0].bought,false);
});
test('catalog addition also confirms, preserves quantity, and catalog-only products need no warning',()=>{
 const s=state(),a={type:'shopping_add',productId:s.products[0].id};let calls=0;
 const approved=confirmShoppingAddition(s,a,message=>{calls++;assert.match(message,/הכמות הקיימת תישמר/);return true;});
 assert.equal(editShopping(s,{...approved,mutationId:'from-catalog'},'אבא',now).items[0].quantity,'2');assert.equal(calls,1);
 s.items=[];assert.equal(confirmShoppingAddition(s,a,()=>assert.fail('not in active list')),a);
});
test('photo import skips rejected duplicates but keeps other rows and uses latest corrected names',()=>{
 const s=state(),newItem={name:'עגבניות',category:'produce',quantity:'1 ק״ג'};
 const action={type:'shopping_import',items:[{...add,name:' חלב '},newItem,{...newItem,name:'עגבניות',quantity:'2 ק״ג'}]};let calls=0;
 const approved=confirmShoppingAddition(s,action,()=>{calls++;return false;});
 assert.equal(calls,2);assert.deepEqual(approved.items,[newItem]);assert.equal(action.items.length,3);
 const next=editShopping(s,{...approved,mutationId:'photo-import'},'אבא',now);assert.equal(next.items.length,2);assert.equal(next.items[0].quantity,'2');
});
test('photo accepts duplicate rows explicitly, all declined sends nothing, and empty quantity is disclosed',()=>{
 const s=state();let calls=0;
 const approved=confirmShoppingAddition(s,{type:'shopping_import',items:[{...add,quantity:''},{...add,quantity:'4'}]},message=>{calls++;if(calls===1)assert.match(message,/ללא כמות/);return true;});
 assert.equal(calls,2);assert.equal(approved.items.length,2);
 const next=editShopping(s,{...approved,mutationId:'photo-accepted'},'אבא',now);assert.equal(next.items[0].quantity,'4');assert.equal(next.items.length,1);
 assert.equal(confirmShoppingAddition(s,{type:'shopping_import',items:[add]},()=>false),null);
});
test('visible pending products are duplicates; Unicode and whitespace use backend name matching',()=>{
 let s=readShopping({});s=editShopping(s,{...add,name:'Extra   Fiber',mutationId:'pending-product'},'אבא',now);
 let calls=0;assert.equal(confirmShoppingAddition(s,{...add,name:'ｅｘｔｒａ Fiber'},()=>{calls++;return false;}),null);assert.equal(calls,1);
 const toggle={type:'shopping_toggle',productId:s.products[0].id,bought:true};assert.equal(confirmShoppingAddition(s,toggle,()=>assert.fail()),toggle);
});
