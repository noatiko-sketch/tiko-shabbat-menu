import assert from 'node:assert/strict';
import {test} from 'node:test';
import {initializeDrive,driveAction,driveSnapshot} from '../lib/drive-engine.ts';
import {projectAction} from '../lib/optimistic-menu.ts';
import {editShopping,readShopping,shoppingName} from '../lib/shopping.ts';
import {defaultShoppingChoices} from '../lib/shopping-defaults.ts';
import {emptyMenu} from '../lib/menu-model.ts';
const ctx={upcoming:'2026-11-14',now:'2026-11-08T10:00:00Z'};
function seed(){return initializeDrive({anchor_saturday:'2026-09-26',anchor_week:1,history:[],deliveries:[]},'',ctx);}
function menu(day=ctx.upcoming){const m=emptyMenu(day,'2026-09-26',1);m.friday.dishes=[{name:'מרק אפונה',category:'soup',prepared_by:'אמא',recipe_url:'https://example.com/recipe'}];return m;}
test('assignment and transfer are atomic for same and next week, including clearing assignment',()=>{
 for(const day of [ctx.upcoming,'2026-11-21'])for(const responsible of ['נעה','']){
  const s=seed();s.menu_drafts[ctx.upcoming]=menu();
  const shot=driveSnapshot(s,ctx.upcoming,ctx);
  const a={type:'transfer',saturday:ctx.upcoming,meal:'friday',index:0,targetSaturday:day,targetMeal:'lunch',responsible,revision:shot.revision};
  const projected=projectAction(shot,a),result=driveAction(s,a,'נעה',ctx);
  assert.equal(projected.current.friday.dishes.length,0);
  const moved=result.state.menu_drafts[day].lunch.dishes.find(d=>d?.name==='מרק אפונה');
  assert.equal(moved.prepared_by,responsible||undefined);assert.equal(moved.recipe_url,'https://example.com/recipe');
  if(day===ctx.upcoming)assert.equal(projected.current.lunch.dishes[0].prepared_by,responsible||undefined);
  assert.equal(s.menu_drafts[ctx.upcoming].friday.dishes[0].prepared_by,'אמא');
 }
 const s=seed();s.menu_drafts[ctx.upcoming]=menu();
 assert.throws(()=>driveAction(s,{type:'transfer',saturday:ctx.upcoming,meal:'friday',index:0,targetSaturday:ctx.upcoming,targetMeal:'lunch',responsible:'לא במשפחה',revision:0},'נעה',ctx));
});
test('unclassified dishes normalize in open menus only, preserving order, recipes and history',()=>{
 const s=seed(),open=menu(),closed=menu('2026-11-07');
 open.friday.manual_order=true;open.friday.dishes[0].category='extra';open.friday.slot_categories=['extra'];closed.friday.dishes[0].category='extra';
 s.menu_drafts[ctx.upcoming]=open;s.menu_drafts[closed.saturday]=closed;s.history=[structuredClone(closed)];
 s.dish_catalog.push({name:'מרק אפונה',category:'extra'},{name:'קינואה',category:'extra'},{name:'מנה משפחתית',category:'extra'},{name:'מיוחדת',category:'custom'});
 const history=structuredClone(s.history),past=structuredClone(closed);
 initializeDrive(s,'',ctx);
 assert.deepEqual(s.dish_catalog.slice(-4).map(d=>d.category),['soup','side','main','custom']);
 const m=s.menu_drafts[ctx.upcoming];assert.equal(m.friday.manual_order,true);assert.equal(m.friday.dishes[0].prepared_by,'אמא');assert.equal(m.friday.dishes[0].recipe_url,'https://example.com/recipe');assert.deepEqual(m.friday.slot_categories,['soup']);assert.equal(s.menu_revisions[ctx.upcoming],1);
 assert.deepEqual(s.history,history);assert.deepEqual(s.menu_drafts[closed.saturday],past);
 const before=structuredClone(s);initializeDrive(s,'',ctx);assert.deepEqual(s,before);
});
test('manual category corrections persist after removal and are reused by the default chooser',()=>{
 let s=editShopping(readShopping({}),{type:'shopping_add',name:'חלב',category:'general',mutationId:'first-milk'},'נעה',ctx.now);
 s=editShopping(s,{type:'shopping_add',name:'  חלב ',category:'dairy',rememberCategory:true,mutationId:'correct-milk'},'נעה',ctx.now);
 const id=s.products[0].id;assert.equal(s.products.length,1);assert.equal(s.products[0].category,'dairy');
 s=editShopping(s,{type:'shopping_remove',productId:id,mutationId:'remove-milk'},'נעה',ctx.now);
 assert.equal(s.products[0].category,'dairy');
 const choices=defaultShoppingChoices(s.products);assert.equal(choices.filter(p=>shoppingName(p.name)==='חלב').length,1);assert.equal(choices.find(p=>shoppingName(p.name)==='חלב').category,'dairy');
 s=editShopping(s,{type:'shopping_import',items:[choices.find(p=>p.name==='חלב'),choices.find(p=>p.name==='עגבניות')].map(p=>({...p,quantity:''})),mutationId:'bulk-defaults'},'נעה',ctx.now);
 assert.equal(s.items.length,2);assert.equal(s.revision,4);
});
