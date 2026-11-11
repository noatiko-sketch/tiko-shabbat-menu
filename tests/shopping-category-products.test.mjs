import assert from 'node:assert/strict';
import {test} from 'node:test';
import {shoppingCategoryProducts} from '../lib/shopping-category-products.ts';
import {editShopping,readShopping} from '../lib/shopping.ts';

test('category-first suggestions include the full catalog even after bought items are cleared',()=>{
 let state=readShopping({});
 for(const [name,category] of [['חלב','dairy'],['גבינה','dairy'],['לחם','general']]){
  state=editShopping(state,{type:'shopping_add',name,category,mutationId:`add-item-${state.products.length}`},'אבא','2026-11-11T08:00:00Z');
 }
 for(const product of state.products)state=editShopping(state,{type:'shopping_toggle',productId:product.id,bought:true,mutationId:`buy-${product.id}`},'אבא','2026-11-11T08:00:00Z');
 state=editShopping(state,{type:'shopping_clear_bought',mutationId:'clear-bought'},'אבא','2026-11-11T08:00:00Z');
 assert.equal(state.items.length,0);
 const before=structuredClone(state.products);
 assert.deepEqual(shoppingCategoryProducts(state.products,'dairy').map(p=>p.name),['גבינה','חלב']);
 assert.deepEqual(state.products,before);
});

test('search stays within selected custom category, normalizes input, and has no result cap',()=>{
 const products=Array.from({length:25},(_,i)=>({id:String(i),name:`Extra Fiber ${i}`,category:'custom-pantry'}));
 products.push({id:'other',name:'Extra Fiber',category:'general'});
 assert.equal(shoppingCategoryProducts(products,'custom-pantry').length,25);
 assert.equal(shoppingCategoryProducts(products,'custom-pantry','  ｅｘｔｒａ   FIBER ').length,25);
 assert.deepEqual(shoppingCategoryProducts(products,'dairy'),[]);
 assert.deepEqual(shoppingCategoryProducts(products,'custom-pantry','missing'),[]);
});
