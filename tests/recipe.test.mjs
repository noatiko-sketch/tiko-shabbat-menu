import assert from 'node:assert/strict';
import {test} from 'node:test';
import {recipeUrl} from '../lib/recipe-url.ts';
import {initializeDrive,driveAction,driveSnapshot,generateDriveMenu,archiveCompletedShabbats} from '../lib/drive-engine.ts';
import {projectAction} from '../lib/optimistic-menu.ts';
import {emptyMenu} from '../lib/menu-model.ts';
const ctx={upcoming:'2026-10-24',now:'2026-10-21T00:00:00Z',today:'2026-10-21'};
const link='https://example.com/recipes/soup?lang=he#steps';
function base(){const s=initializeDrive({anchor_saturday:'2026-09-26',anchor_week:1,history:[],deliveries:[]},'- מרק אפונה\n- סלט חסה',ctx);s.menu_drafts[ctx.upcoming]=emptyMenu(ctx.upcoming,s.anchor_saturday,1);return s;}
function run(s,a){return driveAction(s,{saturday:ctx.upcoming,revision:s.menu_revisions[ctx.upcoming]||0,catalogRevision:s.catalog_revision||0,...a},'נעה',ctx);}
test('recipe URLs support HTTPS, queries and Hebrew; reject unsafe protocols and malformed values',()=>{
 for(const value of [link,'http://example.com','https://מתכונים.ישראל/מרק'])assert.equal(recipeUrl(' '+value+' '),value);
 for(const value of ['javascript:alert(1)','data:text/html,hi','//example.com','https://','https://user:pass@example.com','https://example.com/<script>','https://good.com\\@bad.com','https://x.com/'+ 'x'.repeat(2048),{}])assert.throws(()=>recipeUrl(value));
 assert.equal(recipeUrl('  '),'');assert.equal(recipeUrl(undefined),'');
});
test('save, replace, add again and transfer carry the recipe; omitted fields retain it',()=>{
 let s=base();s=run(s,{type:'add',meal:'friday',responsible:'אביגיל',dish:{name:'מרק אפונה',category:'soup',recipe_url:link}}).state;
 assert.equal(s.dish_catalog.find(d=>d.name==='מרק אפונה').recipe_url,link);
 let snap=driveSnapshot(s,ctx.upcoming,ctx);assert.equal(snap.current.friday.dishes[0].recipe_url,link);
 s=run(s,{type:'replace',meal:'friday',index:0,dish:{name:'מרק אפונה',category:'soup'}}).state;
 assert.equal(s.menu_drafts[ctx.upcoming].friday.dishes[0].recipe_url,link);
 s=run(s,{type:'transfer',meal:'friday',index:0,targetMeal:'lunch',targetSaturday:ctx.upcoming}).state;
 assert.equal(s.menu_drafts[ctx.upcoming].lunch.dishes[0].recipe_url,link);assert.equal(s.menu_drafts[ctx.upcoming].lunch.dishes[0].prepared_by,'אביגיל');
 s=run(s,{type:'add',meal:'friday',dish:{name:'מרק אפונה',category:'soup'}}).state;assert.equal(s.menu_drafts[ctx.upcoming].friday.dishes[0].recipe_url,link);
});
test('catalog recipe changes sync open menus, preserve attribution and history, and clear explicitly',()=>{
 let s=base();s=run(s,{type:'add',meal:'friday',responsible:'אמא',dish:{name:'מרק אפונה',category:'soup',recipe_url:link}}).state;
 s.menu_drafts['2026-10-17']=structuredClone(s.menu_drafts[ctx.upcoming]);s.menu_drafts['2026-10-17'].saturday='2026-10-17';
 s.menu_drafts['2026-10-31']=structuredClone(s.menu_drafts[ctx.upcoming]);s.menu_drafts['2026-10-31'].saturday='2026-10-31';
 const stale=s.menu_revisions[ctx.upcoming];const updated=run(s,{type:'catalog_save',oldName:'מרק אפונה',dish:{name:'מרק אפונה',category:'soup',recipe_url:'https://example.com/new'}});
 assert.equal(updated.state.menu_drafts[ctx.upcoming].friday.dishes[0].recipe_url,'https://example.com/new');assert.equal(updated.state.menu_drafts['2026-10-31'].friday.dishes[0].recipe_url,'https://example.com/new');assert.equal(updated.state.menu_drafts['2026-10-17'].friday.dishes[0].recipe_url,link);
 assert.equal(updated.state.menu_drafts[ctx.upcoming].friday.dishes[0].prepared_by,'אמא');assert.equal(updated.state.menu_drafts[ctx.upcoming].friday.dishes[0].updated_by,'נעה');
 assert.throws(()=>run(updated.state,{type:'move',meal:'friday',index:0,toIndex:1,revision:stale}),/התפריט השתנה/);
 s=run(updated.state,{type:'catalog_save',oldName:'מרק אפונה',dish:{name:'מרק אפונה',category:'soup',recipe_url:''}}).state;
 assert.equal(s.dish_catalog.find(d=>d.name==='מרק אפונה').recipe_url,'');assert.equal(s.menu_drafts[ctx.upcoming].friday.dishes[0].recipe_url,'');
 archiveCompletedShabbats(s,ctx);assert.equal(s.shabbat_archive['2026-10-17'].menu.friday.dishes[0].recipe_url,link);
});
test('automatic generation includes saved recipes; invalid links leave shared state unchanged',()=>{
 let s=base();s=run(s,{type:'catalog_save',dish:{name:'מרק אפונה',category:'soup',recipe_url:link}}).state;
 assert.equal(generateDriveMenu(s,ctx.upcoming,ctx,()=>0).friday.dishes.find(d=>d?.name==='מרק אפונה').recipe_url,link);
 const original=structuredClone(s);assert.throws(()=>run(s,{type:'catalog_save',dish:{name:'מרק אפונה',category:'soup',recipe_url:'javascript:bad'}}));assert.deepEqual(s,original);
});
test('optimistic recipe-only save and catalog clear agree with confirmed snapshots',()=>{
 let s=base();s=run(s,{type:'add',meal:'friday',dish:{name:'מרק אפונה',category:'soup',recipe_url:link}}).state;
 for(const a of [{type:'replace',meal:'friday',index:0,dish:{name:'מרק אפונה',category:'soup',recipe_url:'https://example.com/edit'}},{type:'catalog_save',oldName:'מרק אפונה',dish:{name:'מרק אפונה',category:'soup',recipe_url:''}}]){
  const snap=driveSnapshot(s,ctx.upcoming,ctx),action={...a,saturday:ctx.upcoming,actor:'נעה'};
  const optimistic=projectAction(snap,action);const confirmed=run(s,a).response.snapshot;
  assert.equal(optimistic.current.friday.dishes[0].recipe_url,confirmed.current.friday.dishes[0].recipe_url);assert.equal(optimistic.revision,confirmed.revision);assert.equal(optimistic.catalog.find(d=>d.name==='מרק אפונה').recipe_url,confirmed.catalog.find(d=>d.name==='מרק אפונה').recipe_url);
 }
});
