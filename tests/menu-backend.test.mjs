import assert from 'node:assert/strict';
import {test} from 'node:test';
import {testDatabase} from './sqlite-d1.mjs';
import {getMenu,postMenu,generateMenu} from '../lib/menu-service.ts';
import {emptyMenu,upcomingSaturday,addDays} from '../lib/menu-model.ts';
import {inferDiet,mealAllows,genderText} from '../lib/family.ts';
const sat=upcomingSaturday();
const request=(body,name='נעה',headers={})=>new Request('https://tiko.test/api/menu',{method:body?'POST':'GET',headers:{'x-family-member':encodeURIComponent(name),'content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
const get=async db=>{const r=await getMenu(request(),db);assert.equal(r.status,200);return r.json();};
const post=async(db,a,name='נעה')=>{const r=await postMenu(request({saturday:sat,...a},name),db);return {status:r.status,...await r.json()};};
const names=m=>[...m.friday.dishes,...m.lunch.dishes].map(d=>d?.name);
test('GET automatically creates and persists one shared menu; simultaneous opens do not overwrite it',async()=>{
 const db=testDatabase();const [a,b]=await Promise.all([get(db),get(db)]);assert.equal(a.has_menu,true);assert.equal(names(a.current).length,13);assert.ok(names(a.current).every(Boolean));assert.deepEqual(names(a.current),names(b.current));assert.equal((await db.prepare('SELECT count(*) n FROM menus WHERE saturday=?').bind(sat).first()).n,1);db.close();
});
test('new catalog dishes and custom categories participate in automatic generation without a code change',async()=>{
 const db=testDatabase();const a=await get(db);assert.equal((await post(db,{type:'category_save',id:'new',label:'החדשות שלנו'})).status,200);
 const saved=await post(db,{type:'catalog_save',dish:{name:'מרק משפחתי חדש',category:'new'}});assert.equal(saved.status,200);await db.prepare("DELETE FROM catalog WHERE name <> 'מרק משפחתי חדש'").run();
 const m=await generateMenu(db,emptyMenu(sat,'2026-09-26',1),'בדיקה',()=>0);assert.ok(names(m).includes('מרק משפחתי חדש'));assert.equal(names(m).filter(Boolean).length,1);db.close();
});
test('adding directly to a menu saves to catalog, infers category, and survives reload',async()=>{
 const db=testDatabase(),a=await get(db);const r=await post(db,{type:'add',revision:a.revision,meal:'friday',dish:{name:'מרק חדש ישר לתפריט',category:'auto'}});assert.equal(r.status,200);assert.ok(r.snapshot.catalog.some(d=>d.name==='מרק חדש ישר לתפריט'&&d.category==='soup'));const b=await get(db);assert.equal(b.current.friday.dishes.find(d=>d?.name==='מרק חדש ישר לתפריט').updated_by,'נעה');assert.ok(Object.values(b.candidates).some(list=>list.some(d=>d.name==='מרק חדש ישר לתפריט')));db.close();
});
test('server rejects meat in dairy meals and dairy in meat meals, permits pareve in both',async()=>{
 const db=testDatabase(),a=await get(db);const rejected=await post(db,{type:'add',revision:a.revision,meal:'friday',dish:{name:'עוף עם אורז',category:'main'}});assert.equal(rejected.status,400);assert.equal((await get(db)).revision,a.revision);
 let meatSat=sat;while(emptyMenu(meatSat,'2026-09-26',1).week!==3)meatSat=addDays(meatSat,7);
 const dairy=await post(db,{type:'add',saturday:meatSat,revision:0,meal:'lunch',dish:{name:'פשטידת גבינות',category:'pastry'}});assert.equal(dairy.status,400);
 const allowed=await post(db,{type:'add',saturday:meatSat,revision:0,meal:'lunch',dish:{name:'סלט עגבניות חדש',category:'salad'}});assert.equal(allowed.status,200);db.close();
});
test('auto menu respects only meal dietary exclusions and does not require dairy dishes',async()=>{
 const db=testDatabase();await get(db);for(let week=1;week<=3;week++){const m=await generateMenu(db,{...emptyMenu(sat,'2026-09-26',1),week});for(const meal of ['friday','lunch'])for(const d of m[meal].dishes.filter(Boolean))assert.ok(mealAllows(inferDiet(d.name),meal,week),d.name);}
 assert.equal(mealAllows('pareve','friday',3),true);assert.equal(mealAllows('pareve','lunch',3),true);assert.equal(mealAllows('dairy','lunch',3),false);assert.equal(mealAllows('meat','friday',1),false);db.close();
});
test('compare-and-swap rejects simultaneous stale edits and does not create losing catalog or activity rows',async()=>{
 const db=testDatabase(),a=await get(db);const actions=['מרק מקביל א','מרק מקביל ב'].map(name=>({type:'add',revision:a.revision,meal:'friday',dish:{name,category:'soup'}}));const results=await Promise.all(actions.map(a=>post(db,a)));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const losing=actions[results.findIndex(r=>r.status===409)].dish.name;assert.equal(await db.prepare('SELECT name FROM catalog WHERE name=?').bind(losing).first(),null);const b=await get(db);assert.equal(b.revision,a.revision+1);assert.equal((await db.prepare('SELECT count(*) n FROM activity WHERE saturday=?').bind(sat).first()).n,1);db.close();
});
test('individual approvals persist across family members and an edit invalidates all old approvals',async()=>{
 const db=testDatabase(),a=await get(db);for(const n of ['נעה','אבא'])assert.equal((await post(db,{type:'family_approve',revision:a.revision},n)).status,200);
 const b=await get(db);assert.equal(b.family_status.filter(s=>s.approved_revision===b.revision).length,2);
 const c=await post(db,{type:'add',revision:b.revision,meal:'friday',dish:{name:'מרק אחרי אישור',category:'soup'}});assert.equal(c.status,200);assert.equal(c.snapshot.current.approved,false);assert.equal(c.snapshot.family_status.filter(s=>s.approved_revision===c.snapshot.revision).length,0);
 assert.equal((await post(db,{type:'family_approve',revision:b.revision},'אבא')).status,409);db.close();
});
test('seen tracks exact revision and is isolated by family name and upcoming week',async()=>{
 const db=testDatabase(),a=await get(db);assert.equal((await post(db,{type:'seen',revision:a.revision},'יפעת')).status,200);const b=await get(db);assert.equal(b.family_status.find(s=>s.name==='יפעת').seen_revision,a.revision);assert.ok(!b.family_status.some(s=>s.name==='אמא'));assert.equal((await post(db,{type:'seen',saturday:addDays(sat,7),revision:0})).status,400);db.close();
});
test('deleting category moves dishes to fallback and reload never resurrects removed categories',async()=>{
 const db=testDatabase();await get(db);await post(db,{type:'category_save',id:'temp',label:'זמנית'});await post(db,{type:'catalog_save',dish:{name:'מנה בלי קטגוריה בעתיד',category:'temp'}});assert.equal((await post(db,{type:'category_remove',id:'temp'})).status,200);const a=await get(db);assert.ok(!a.categories.temp);assert.equal(a.catalog.find(d=>d.name==='מנה בלי קטגוריה בעתיד').category,'extra');assert.equal((await post(db,{type:'category_remove',id:'extra'})).status,400);db.close();
});
test('deleting a catalog dish survives reload and does not change historical menu dishes',async()=>{
 const db=testDatabase(),a=await get(db),name=a.current.friday.dishes[0].name;assert.equal((await post(db,{type:'catalog_remove',oldName:name})).status,200);const b=await get(db);assert.ok(!b.catalog.some(d=>d.name===name));assert.equal(b.current.friday.dishes[0].name,name);db.close();
});
test('invalid dates, indexes, empty names, unknown actions and cross-origin writes are rejected',async()=>{
 const db=testDatabase(),a=await get(db);for(const action of [{type:'add',meal:'friday',dish:{name:' ',category:'auto'}},{type:'replace',meal:'friday',index:999,dish:{name:'מרק',category:'soup'}},{type:'unknown'},{type:'add',saturday:'2026-02-31'}])assert.ok((await post(db,{revision:a.revision,...action})).status>=400);
 assert.equal((await postMenu(request({type:'seen',saturday:sat,revision:a.revision},'נעה',{origin:'https://evil.test'}),db)).status,403);db.close();
});
test('an intentionally emptied menu is not regenerated on the next GET',async()=>{
 const db=testDatabase(),a=await get(db);await db.prepare('UPDATE menus SET payload=? WHERE saturday=?').bind(JSON.stringify(emptyMenu(sat,'2026-09-26',1)),sat).run();const b=await get(db);assert.equal(b.current.friday.dishes.length,0);assert.equal((await post(db,{type:'family_approve',revision:b.revision})).status,400);db.close();
});
test('dad receives masculine Hebrew and recipe names detect dairy/meat with vegetarian exceptions',()=>{
 assert.equal(genderText('כתבי שם ושמרי והוסיפי','אבא'),'כתוב שם ושמור והוסף');assert.equal(inferDiet('קבב צמחוני'),'pareve');assert.equal(inferDiet('קבב (לא צמחוני)'),'meat');assert.equal(inferDiet('פסטה ללא גבינה'),'pareve');assert.equal(inferDiet('מאפה מוצרלה'),'dairy');
});
test('mixed meat/dairy dishes are excluded from both meal types; plant milk remains pareve',()=>{
 assert.equal(inferDiet('עוף עם שמנת'),'mixed');assert.equal(mealAllows(inferDiet('עוף עם שמנת'),'friday',1),false);assert.equal(mealAllows(inferDiet('עוף עם שמנת'),'lunch',3),false);assert.equal(inferDiet('מרק עם חלב קוקוס'),'pareve');
});
test('server rejects a 21st dish and incomplete menus cannot be approved',async()=>{
 const db=testDatabase(),a=await get(db);const menu=a.current;menu.friday.dishes=Array.from({length:20},(_,i)=>({name:`מרק ${i}`,category:'soup'}));menu.friday.slot_categories=Array(20).fill('soup');menu.lunch.dishes=[null];await db.prepare('UPDATE menus SET payload=? WHERE saturday=?').bind(JSON.stringify(menu),sat).run();
 assert.equal((await post(db,{type:'add',meal:'friday',revision:a.revision,dish:{name:'מרק 21',category:'soup'}})).status,400);assert.equal((await post(db,{type:'family_approve',revision:a.revision})).status,400);db.close();
});
test('an interrupted catalog seed is completed before generating a menu',async()=>{
 const db=testDatabase();await db.prepare("INSERT INTO food_categories (id,label) VALUES ('salad','סלט')").run();const a=await get(db);assert.ok(a.catalog.length>100);assert.ok(names(a.current).every(Boolean));assert.ok(!Object.keys(a.categories).includes('__catalog_ready_v1'));db.close();
});
test('dips do not occupy the main slot; an old automatic dip is repaired without rewriting family edits',async()=>{
 const db=testDatabase(),a=await get(db);for(let i=0;i<30;i++){const m=await generateMenu(db,a.current);assert.notEqual(m.lunch.dishes[3]?.category,'dip');}
 const bad=structuredClone(a.current);bad.lunch.dishes[3]={name:'רוטב ירוק',category:'dip',updated_by:'אוטומטית'};await db.prepare('UPDATE menus SET payload=? WHERE saturday=?').bind(JSON.stringify(bad),sat).run();const repaired=await get(db);assert.equal(repaired.current.lunch.dishes[3].category,'main');assert.equal(repaired.revision,a.revision+1);assert.deepEqual(repaired.current.friday.dishes,bad.friday.dishes);
 bad.lunch.dishes[3].updated_by='נעה';await db.prepare('UPDATE menus SET payload=? WHERE saturday=?').bind(JSON.stringify(bad),sat).run();assert.equal((await get(db)).current.lunch.dishes[3].name,'רוטב ירוק');db.close();
});
test('category renaming keeps category IDs and dish assignments; new names are classified automatically',async()=>{
 const db=testDatabase();await get(db);const before=await db.prepare("SELECT count(*) n FROM catalog WHERE category='soup'").first();const renamed=await post(db,{type:'category_save',id:'soup',label:'מרקים חמים'});assert.equal(renamed.status,200);assert.equal(renamed.snapshot.categories.soup,'מרקים חמים');assert.equal((await db.prepare("SELECT count(*) n FROM catalog WHERE category='soup'").first()).n,before.n);
 const created=await post(db,{type:'catalog_save',dish:{name:'מרק שמתווסף בלי שאלה',category:'auto'}});assert.equal(created.snapshot.catalog.find(d=>d.name==='מרק שמתווסף בלי שאלה').category,'soup');assert.ok(!('activity' in created.snapshot));db.close();
});
test('dessert category seeds exactly the requested dishes once and respects later removals',async()=>{
 const db=testDatabase(),a=await get(db);for(const n of ['עוגה','גלידה','טפיוקה','סלט פירות','פירות','פבלובה','עוגת יומולדת'])assert.ok(a.catalog.some(d=>d.name===n&&d.category==='dessert'),n);assert.equal(a.categories.dessert,'מנה אחרונה');await post(db,{type:'catalog_remove',oldName:'גלידה'});assert.ok(!(await get(db)).catalog.some(d=>d.name==='גלידה'));db.close();
});
test('automatic menus start Friday with soup and finish both meals with compatible dessert',async()=>{
 const db=testDatabase();await get(db);for(let week=1;week<=3;week++){const m=await generateMenu(db,{...emptyMenu(sat,'2026-09-26',1),week});assert.equal(m.friday.dishes[0].category,'soup');for(const kind of ['friday','lunch']){assert.equal(m[kind].dishes.at(-1).category,'dessert');assert.ok(mealAllows(inferDiet(m[kind].dishes.at(-1).name),kind,week));}assert.equal(m.layout_version,2);}db.close();
});
test('existing upcoming menu gets desserts once and keeps all prior dishes when upgrading the layout',async()=>{
 const db=testDatabase(),a=await get(db),old=structuredClone(a.current);delete old.layout_version;old.approved=true;for(const kind of ['friday','lunch'])old[kind].dishes=old[kind].dishes.filter(d=>d?.category!=='dessert');old.friday.dishes.reverse();await db.prepare('UPDATE menus SET payload=? WHERE saturday=?').bind(JSON.stringify(old),sat).run();const b=await get(db);assert.equal(b.current.friday.dishes[0].category,'soup');assert.equal(b.current.approved,false);for(const kind of ['friday','lunch']){assert.equal(b.current[kind].dishes.filter(d=>d?.category==='dessert').length,1);for(const d of old[kind].dishes)assert.ok(b.current[kind].dishes.some(x=>x?.name===d.name));}assert.deepEqual(names((await get(db)).current),names(b.current));db.close();
});
test('manual ordering persists, keeps dish metadata and category slots, invalidates likes, and rejects stale or invalid moves',async()=>{
 const db=testDatabase(),a=await get(db);await post(db,{type:'family_approve',revision:a.revision});const from=a.current.friday.dishes.length-1,original=a.current.friday.dishes[from];const moved=await post(db,{type:'move',revision:a.revision,meal:'friday',index:from,toIndex:0});assert.equal(moved.status,200);assert.deepEqual(moved.snapshot.current.friday.dishes[0],original);assert.equal(moved.snapshot.current.friday.slot_categories[0],'dessert');assert.equal(moved.snapshot.current.approved,false);assert.equal(moved.snapshot.current.friday.manual_order,true);assert.equal((await get(db)).current.friday.dishes[0].name,original.name);assert.equal((await post(db,{type:'move',revision:a.revision,meal:'friday',index:0,toIndex:1})).status,409);assert.equal((await post(db,{type:'move',revision:moved.snapshot.revision,meal:'friday',index:0,toIndex:99})).status,400);db.close();
});
