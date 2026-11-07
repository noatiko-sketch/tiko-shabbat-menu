import assert from 'node:assert/strict';
import {test} from 'node:test';
import {addDays,upcomingSaturday,validSaturday,emptyMenu,editMenu} from '../lib/menu-model.ts';
const add=(saturday,meal,name)=>({type:'add',saturday,meal,dish:{name,category:'extra'}});
test('week navigation crosses months and uses Jerusalem calendar',()=>{
 assert.equal(addDays('2026-10-03',-7),'2026-09-26');
 assert.equal(upcomingSaturday(new Date('2026-10-09T22:30:00Z')),'2026-10-10');
 assert.equal(validSaturday('2026-10-03'),true);
 assert.equal(validSaturday('2026-10-09'),false);
 assert.equal(validSaturday('2026-10-17'),true);
 assert.equal(validSaturday('2026-02-31'),false);
});
test('default menu switches at Saturday 18:00 Jerusalem time in summer and winter',()=>{
 for (const [instant, expected] of [
  ['2026-10-09T20:59:59Z','2026-10-10'], // Friday 23:59:59, summer time
  ['2026-10-09T21:00:00Z','2026-10-10'], // Saturday midnight
  ['2026-10-10T14:59:59Z','2026-10-10'], // Saturday 17:59:59
  ['2026-10-10T15:00:00Z','2026-10-17'], // Saturday 18:00
  ['2026-10-10T20:59:59Z','2026-10-17'], // Saturday 23:59:59
  ['2026-10-10T21:00:00Z','2026-10-17'], // Sunday midnight
  ['2026-10-30T21:59:59Z','2026-10-31'], // Friday 23:59:59, winter time
  ['2026-10-30T22:00:00Z','2026-10-31'], // Saturday midnight
  ['2026-10-31T15:59:59Z','2026-10-31'], // Saturday 17:59:59
  ['2026-10-31T16:00:00Z','2026-11-07'], // Saturday 18:00, across month boundary
  ['2026-10-31T21:59:59Z','2026-11-07'], // Saturday 23:59:59
  ['2026-10-31T22:00:00Z','2026-11-07'], // Sunday midnight
 ]) assert.equal(upcomingSaturday(new Date(instant)),expected,instant);
});
test('past Saturdays can add/remove independently in both meals',()=>{
 const original=emptyMenu('2026-09-19','2026-09-26',1);
 assert.equal(original.week,3);assert.equal(original.friday.date,'2026-09-18');
 const friday=editMenu(original,add(original.saturday,'friday','  מרק אפונה  '));
 const lunch=editMenu(friday,add(original.saturday,'lunch','אורז'));
 assert.equal(lunch.friday.dishes[0].name,'מרק אפונה');assert.equal(lunch.lunch.dishes[0].name,'אורז');
 assert.equal(original.friday.dishes.length,0);
 const removed=editMenu(lunch,{type:'remove',saturday:original.saturday,meal:'lunch',index:0});
 assert.equal(removed.lunch.dishes.length,0);assert.equal(removed.lunch.slot_categories.length,0);
 assert.equal(removed.friday.dishes.length,1);
});
test('historical sent menus are editable without changing delivery records',()=>{
 const original={...emptyMenu('2026-10-03','2026-09-26',1),sent:true,approved:true};
 const edited=editMenu(original,add(original.saturday,'lunch','מנה'));
 assert.equal(edited.sent,true);assert.equal(edited.approved,false);assert.equal(original.approved,true);
});
test('approval persists chosen dishes and editing invalidates approval',()=>{
 const menu=editMenu(emptyMenu('2026-10-03','2026-09-26',1),add('2026-10-03','friday','סלט'));
 const approved=editMenu(menu,{type:'approve',saturday:menu.saturday});
 assert.equal(approved.approved,true);
 assert.equal(editMenu(approved,add(menu.saturday,'lunch','דג')).approved,false);
 assert.throws(()=>editMenu(menu,add(menu.saturday,'lunch','   ')));
 assert.throws(()=>editMenu(menu,{type:'remove',saturday:menu.saturday,meal:'friday',index:10}));
});

test('future plans persist separately with the correct week cycle',()=>{
 const first=emptyMenu('2026-10-17','2026-09-26',1);
 const second=emptyMenu('2026-10-24','2026-09-26',1);
 assert.equal(first.week,1);assert.equal(second.week,2);
 assert.equal(first.friday.date,'2026-10-16');
 const planned=editMenu(first,add(first.saturday,'lunch','מנה עתידית'));
 assert.equal(planned.lunch.dishes[0].name,'מנה עתידית');
 assert.equal(second.lunch.dishes.length,0);
});

test('new dishes infer a category and preserve attribution without mutating source',()=>{
 const source=emptyMenu('2026-10-24','2026-09-26',1);
 const edited=editMenu(source,{...add(source.saturday,'friday','מרק אפונה'),dish:{name:'מרק אפונה',category:'auto'},actor:'נעה'});
 assert.equal(edited.friday.dishes[0].category,'soup');
 assert.equal(edited.friday.dishes[0].updated_by,'נעה');
 assert.equal(edited.friday.slot_categories[0],'soup');
 assert.equal(source.friday.dishes.length,0);
 const replaced=editMenu(edited,{type:'replace',saturday:source.saturday,meal:'friday',index:0,dish:{name:'מנה מיוחדת',category:'custom-category'},actor:'אבא'});
 assert.equal(replaced.friday.dishes[0].category,'custom-category');
 assert.equal(replaced.friday.slot_categories[0],'custom-category');
 assert.equal(replaced.friday.dishes[0].updated_by,'אבא');
});
test('unknown foods are classified as main dishes',()=>{
 const source=emptyMenu('2026-10-24','2026-09-26',1);
 const edited=editMenu(source,{...add(source.saturday,'lunch','מנה משפחתית'),dish:{name:'מנה משפחתית',category:'auto'}});
 assert.equal(edited.lunch.dishes[0].category,'main');
});
test('new dishes insert before dessert by default, while explicit manual order remains free',()=>{
 const source=emptyMenu('2026-10-24','2026-09-26',1);source.friday.dishes=[{name:'סלט',category:'salad'},{name:'פירות',category:'dessert'}];source.friday.slot_categories=['salad','dessert'];
 const next=editMenu(source,{type:'add',saturday:source.saturday,meal:'friday',dish:{name:'מרק אפונה',category:'soup'}});assert.equal(next.friday.dishes[0].name,'מרק אפונה');assert.equal(next.friday.dishes.at(-1).category,'dessert');
 const moved=editMenu(next,{type:'move',saturday:source.saturday,meal:'friday',index:2,toIndex:0});assert.equal(moved.friday.dishes[0].category,'dessert');assert.equal(moved.friday.manual_order,true);
});
