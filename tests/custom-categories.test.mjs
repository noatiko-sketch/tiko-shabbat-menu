import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {editShopping,readShopping,shoppingAction,shoppingSnapshot,allShoppingCategories} from '../lib/shopping.ts';
import {initializeDrive,driveSnapshot,driveAction} from '../lib/drive-engine.ts';
import {confirmedShoppingItems} from '../lib/shopping-scan.ts';
const now='2026-11-10T08:00:00Z',id='custom-12345678-abcd',actor='אבא';
const add={type:'shopping_category_add',id,label:'  חטיפים   לילדים ',mutationId:'category-12345678',revision:0};
test('shopping categories survive snapshots, support every product flow and keep meal categories separate',()=>{
 const original={food_categories:{salad:'סלטים'}};
 const result=shoppingAction(original,add,actor,now);
 assert.equal(original.shopping,undefined);
 const snapshot=shoppingSnapshot(result.state),categories=allShoppingCategories(snapshot.shopping);
 assert.equal(categories[id],'חטיפים לילדים');assert.deepEqual(result.state.food_categories,original.food_categories);
 let s=editShopping(snapshot.shopping,{type:'shopping_add',name:'בייגלה',category:id,mutationId:'product-12345678'},actor,now);
 s=editShopping(s,{type:'shopping_default_save',name:'קרקרים',category:id,mutationId:'default-12345678'},actor,now);
 s=editShopping(s,{type:'shopping_recategorize',productId:s.products[0].id,category:'general',mutationId:'reclass-12345678'},actor,now);
 s=editShopping(s,{type:'shopping_import',items:[{name:'פופקורן',category:id,quantity:'2'}],mutationId:'import-12345678'},actor,now);
 assert.equal(s.products.find(p=>p.name==='פופקורן').category,id);
 assert.equal(s.defaultProductIds.length,1);
 assert.equal(confirmedShoppingItems([{name:'חדש',quantity:'',category:id,selected:true}],categories)[0].category,id);
 assert.equal(readShopping({shopping:s}).categories[id],'חטיפים לילדים');
 assert.equal(shoppingAction(result.state,add,actor,now).changed,false);
 assert.throws(()=>shoppingAction(result.state,{...add,mutationId:'stale-12345678'},actor,now),e=>e.status===409);
});
test('shopping rejects duplicate normalized names, invalid categories and empty labels',()=>{
 const s=editShopping(readShopping({}),add,actor,now);
 for(const label of ['חטיפים לילדים',' חטיפים  לילדים ','   ','כללי'])assert.throws(()=>editShopping(s,{...add,id:'custom-other',label},actor,now));
 assert.throws(()=>editShopping(s,{...add,id:'general',label:'אחר'},actor,now));
 assert.throws(()=>editShopping(s,{type:'shopping_add',name:'חדש',category:'unknown',mutationId:'unknown-12345678'},actor,now));
});
test('meal categories persist across snapshots, reject duplicates and classify a new dish explicitly',()=>{
 const ctx={upcoming:'2026-11-14',now};let s=initializeDrive({anchor_saturday:'2026-09-26',anchor_week:1,history:[],deliveries:[]},'',ctx);driveSnapshot(s,ctx.upcoming,ctx);
 const run=(action)=>driveAction(s,{saturday:ctx.upcoming,revision:s.menu_revisions[ctx.upcoming]||0,catalogRevision:s.catalog_revision||0,...action},actor,ctx);
 s=run({type:'category_save',id,label:'  מיוחדים  '}).state;
 assert.equal(driveSnapshot(s,ctx.upcoming,ctx).categories[id],'מיוחדים');
 assert.throws(()=>run({type:'category_save',id:'custom-other',label:' מיוחדים '}));
 s=run({type:'add',meal:'friday',dish:{name:'תבשיל ירקות מיוחד',category:id}}).state;
 assert.equal(driveSnapshot(s,ctx.upcoming,ctx).current.friday.dishes.find(d=>d?.name==='תבשיל ירקות מיוחד').category,id);
 assert.equal(s.shopping,undefined);
});
test('generated Google bundle includes category validation and persistence',()=>{
 const sandbox={console,structuredClone};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('google/Code.gs','utf8'),sandbox);
 const result=sandbox.TikoDrive.shoppingAction({},add,actor,now);
 assert.equal(result.state.shopping.categories[id],'חטיפים לילדים');
});
