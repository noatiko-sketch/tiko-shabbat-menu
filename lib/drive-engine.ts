import {categoryLabel,duplicateCategory} from './custom-categories.ts';
import {recipeUrl} from './recipe-url.ts';
import {family,defaultCategories,inferCategory,inferDiet,mealAllows} from './family.ts';
import {categories,editMenu,emptyMenu,validSaturday,addDays,type Menu,type Dish,type Action} from './menu-model.ts';
type State=Record<string,any>;
type Context={upcoming:string;now:string;today?:string};
export const driveStateId='1wc9VbyXuLl9QTWVPLUYiU1vUQjz1vmZI';
const copy=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
const norm=(name:string)=>name.normalize('NFKC').replace(/\([^)]*\)/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().toLowerCase();
const variant=(name:string)=>norm(name).split(' ').slice(0,2).join(' ');
export class DriveError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
const check=(condition:unknown,message:string,status=400)=>{if(!condition)throw new DriveError(message,status);};
export function initializeDrive(state:State,foods:string,ctx:Context){
 check(state.anchor_saturday==='2026-09-26'&&state.anchor_week===1&&Array.isArray(state.history)&&Array.isArray(state.deliveries),'מבנה המאגר אינו תקין.',503);
 state.menu_drafts||={};state.menu_revisions||={};state.excluded_dishes||=[];state.custom_dishes||=[];state.manual_dishes||=[];state.food_categories||={...defaultCategories};state.family_status||={};
 if(!state.dish_catalog){
 const all:Dish[]=foods.split('\n').filter(line=>line.startsWith('- ')).map(line=>({name:line.slice(2).split(' (')[0].trim(),category:'auto'}));
 all.push(...state.manual_dishes,...state.custom_dishes,...Object.values(state.menu_drafts).flatMap((m:any)=>[...m.friday.dishes,...m.lunch.dishes].filter(Boolean)));
 const excluded=new Set(state.excluded_dishes.map(norm)),seen=new Set<string>();state.dish_catalog=[];
 for(const d of all){if(!d?.name||excluded.has(norm(d.name))||seen.has(norm(d.name)))continue;seen.add(norm(d.name));const category=d.category&&d.category!=='auto'&&d.category!=='extra'?d.category:inferCategory(d.name);state.dish_catalog.push({...d,category:state.food_categories[category]?category:'extra',diet:inferDiet(d.name),updated_by:d.updated_by||'',updated_at:d.updated_at||''});}
 }
 const known=new Set(state.dish_catalog.map((d:Dish)=>norm(d.name))),excluded=new Set(state.excluded_dishes.map(norm));
 for(const dish of [...state.custom_dishes,...state.manual_dishes]){if(dish?.name&&!known.has(norm(dish.name))&&!excluded.has(norm(dish.name))){const category=state.food_categories[dish.category]?dish.category:inferCategory(dish.name);state.dish_catalog.push({...dish,category:state.food_categories[category]?category:'extra',diet:inferDiet(dish.name)});known.add(norm(dish.name));}}
 if(!state.dessert_seeded){state.food_categories.dessert||='מנה אחרונה';for(const name of ['עוגה','גלידה','טפיוקה','סלט פירות','פירות','פבלובה','עוגת יומולדת'])if(!state.dish_catalog.some((d:Dish)=>norm(d.name)===norm(name))&&!state.excluded_dishes.some((n:string)=>norm(n)===norm(name)))state.dish_catalog.push({name,category:'dessert',diet:inferDiet(name),updated_by:'',updated_at:''});state.dessert_seeded=true;}
 // Normalize unclassified dishes on every weekly load, without rewriting archives,
 // closed history, assignments, recipes or the family's manual order.
 let classified=false;
 const categoryFor=(name:string)=>{const id=inferCategory(name);return state.food_categories[id]?id:state.food_categories.main?'main':Object.keys(state.food_categories).find(id=>id!=='extra')||'extra';};
 for(const list of [state.dish_catalog,state.manual_dishes,state.custom_dishes])for(const dish of list){
  if(dish&&(dish.category==='extra'||dish.category==='auto'||!dish.category)){
   const category=categoryFor(dish.name);if(category!==dish.category){dish.category=category;classified=true;}
  }
 }
 if(classified)state.catalog_revision=Number(state.catalog_revision||0)+1;
 for(const [day,original] of Object.entries(state.menu_drafts) as [string,Menu][]){
  if(day<ctx.upcoming||state.shabbat_archive?.[day])continue;
  const menu=copy(original);let changed=false;
  for(const kind of ['friday','lunch'] as const)menu[kind].dishes.forEach((dish,index)=>{
   if(!dish||dish.category!=='extra'&&dish.category!=='auto'&&dish.category) return;
   const category=categoryFor(dish.name);if(category===dish.category)return;
   dish.category=category;if(menu[kind].slot_categories)menu[kind].slot_categories![index]=category;changed=true;
  });
  if(changed){menu.approved=false;delete menu.approved_at;state.menu_drafts[day]=menu;state.menu_revisions[day]=Number(state.menu_revisions[day]||0)+1;}
 }
 return state;
}
const saved=(s:State,day:string):Menu|undefined=>s.menu_drafts[day]||s.history.find((m:Menu)=>m.saturday===day);
const revision=(s:State,day:string)=>Number(s.menu_revisions[day]||0);
function catalog(s:State){const blocked=new Set(s.excluded_dishes.map(norm));return s.dish_catalog.filter((d:Dish)=>!blocked.has(norm(d.name))).map((d:Dish)=>({...d,category:s.food_categories[d.category]?d.category:'extra',diet:inferDiet(d.name)})).sort((a:Dish,b:Dish)=>a.name.localeCompare(b.name,'he'));}
function resolve(s:State,dish:Dish){const name=String(dish?.name||'').trim();check(name&&name.length<=100,'יש לכתוב שם מנה עד 100 תווים.');const id=dish.category&&dish.category!=='auto'?dish.category:inferCategory(name);const existing=s.dish_catalog.find((d:Dish)=>norm(d.name)===norm(name));const link=dish.recipe_url!==undefined?recipeUrl(dish.recipe_url):existing?.recipe_url;return {name,category:s.food_categories[id]?id:'extra',...(link!==undefined?{recipe_url:link}:{})};}
function putDish(s:State,dish:Dish,actor:string,now:string){const row={...dish,diet:inferDiet(dish.name),updated_by:actor,updated_at:now};s.dish_catalog=s.dish_catalog.filter((d:Dish)=>norm(d.name)!==norm(row.name));s.dish_catalog.push(row);s.excluded_dishes=s.excluded_dishes.filter((n:string)=>norm(n)!==norm(row.name));s.manual_dishes=s.manual_dishes.filter((d:Dish)=>norm(d.name)!==norm(row.name));s.manual_dishes.push(copy(row));return row;}
// Keep the one recipe per catalog dish in open menus, preserving closed Saturdays.
function syncRecipe(s:State,dish:Dish,ctx:Context,except?:string){
 if(dish.recipe_url===undefined)return;
 for(const [day,menu] of Object.entries(s.menu_drafts) as [string,Menu][]){
  if(day<ctx.upcoming||day===except||s.shabbat_archive?.[day])continue;
  let changed=false;
  for(const d of [...menu.friday.dishes,...menu.lunch.dishes])if(d&&norm(d.name)===norm(dish.name)&&(d.recipe_url||'')!==dish.recipe_url){d.recipe_url=dish.recipe_url;changed=true;}
  if(changed){s.menu_revisions[day]=revision(s,day)+1;menu.approved=false;delete menu.approved_at;}
 }
}
function removeDish(s:State,name:string){s.dish_catalog=s.dish_catalog.filter((d:Dish)=>norm(d.name)!==norm(name));s.custom_dishes=s.custom_dishes.filter((d:Dish)=>norm(d.name)!==norm(name));s.manual_dishes=s.manual_dishes.filter((d:Dish)=>norm(d.name)!==norm(name));if(!s.excluded_dishes.some((n:string)=>norm(n)===norm(name)))s.excluded_dishes.push(name);}
function approveHistory(s:State,menu:Menu){s.history=s.history.filter((m:Menu)=>m.saturday!==menu.saturday);s.history.push(copy(menu));s.history.sort((a:Menu,b:Menu)=>b.saturday.localeCompare(a.saturday));}
export function generateDriveMenu(s:State,day:string,ctx:Context,random=Math.random){
 const menu=emptyMenu(day,s.anchor_saturday,s.anchor_week),foods=catalog(s),used=new Set<string>();
 const recent=new Set(s.history.filter((m:Menu)=>m.saturday<day).sort((a:Menu,b:Menu)=>b.saturday.localeCompare(a.saturday)).slice(0,2).flatMap((m:Menu)=>[...m.friday.dishes,...m.lunch.dishes].filter(Boolean).map(d=>variant(d!.name))));
 for(const kind of ['friday','lunch'] as const){menu[kind].dishes=categories[kind].map(category=>{const available=foods.filter((d:any)=>mealAllows(d.diet,kind,menu.week)&&!used.has(norm(d.name)));const matches=available.filter((d:Dish)=>d.category===category||(category==='main'&&(d.category==='extra'||!defaultCategories[d.category])));const fresh=matches.filter((d:Dish)=>!recent.has(variant(d.name)));const fallback=category==='dessert'?[]:available.filter((d:Dish)=>d.category!=='dessert');const freshFallback=fallback.filter((d:Dish)=>!recent.has(variant(d.name)));const choices=fresh.length?fresh:matches.length?matches:freshFallback.length?freshFallback:fallback;const dish=choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];if(!dish)return null;used.add(norm(dish.name));return {name:dish.name,category:dish.category,updated_by:'אוטומטית',updated_at:ctx.now,...(dish.recipe_url!==undefined?{recipe_url:dish.recipe_url}:{})};});menu[kind].slot_categories=menu[kind].dishes.map((d,i)=>d?.category||categories[kind][i]);}
 menu.approved=false;menu.layout_version=2;return menu;
}
export function driveSnapshot(s:State,day:string,ctx:Context,autoGenerate=true,compact=false){
 check(validSaturday(day),'תאריך שבת לא תקין.');let menu=saved(s,day);
 if(!menu&&day===ctx.upcoming&&autoGenerate){menu=generateDriveMenu(s,day,ctx);s.menu_drafts[day]=menu;s.menu_revisions[day]=revision(s,day)+1;}
 const current=menu||emptyMenu(day,s.anchor_saturday,s.anchor_week),foods=catalog(s),candidates:Record<string,Dish[]>={},candidateGroups:Record<string,Dish[]>={};
 if(!compact)for(const kind of ['friday','lunch'] as const)current[kind].dishes.forEach((dish,i)=>{const category=dish?.category||current[kind].slot_categories?.[i]||'extra';const key=kind+':'+category;candidates[`${kind}:${i}`]=candidateGroups[key]||=(foods.filter((d:any)=>d.category===category&&mealAllows(d.diet,kind,current.week)));});
 return {api_version:10,storage:'google-drive',state_id:driveStateId,status:'ready',current:copy(current),previous:compact?undefined:copy(s.history.filter((m:Menu)=>m.saturday<day).sort((a:Menu,b:Menu)=>b.saturday.localeCompare(a.saturday))[0]||null),revision:revision(s,day),catalog_revision:Number(s.catalog_revision||0),has_menu:!!menu,upcoming_saturday:ctx.upcoming,catalog:foods,categories:copy(s.food_categories),candidates,archived_saturdays:Object.keys(s.shabbat_archive||{}).sort(),family_status:day===ctx.upcoming?Object.values(s.family_status).filter((x:any)=>x.saturday===day):[]};
}
export function archiveCompletedShabbats(s:State,ctx:Context){
 const today=ctx.today||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ctx.now));
 const menus=new Map<string,Menu>();for(const menu of s.history)menus.set(menu.saturday,menu);for(const menu of Object.values(s.menu_drafts) as Menu[])menus.set(menu.saturday,menu);
 let count=0;for(const [day,menu] of menus){if(day>=today||s.shabbat_archive?.[day]||!validSaturday(day))continue;s.shabbat_archive||={};s.shabbat_archive[day]={saturday:day,closed_at:ctx.now,revision:revision(s,day),menu:copy(menu),family_status:copy(Object.values(s.family_status).filter((x:any)=>x.saturday===day)),categories:copy(s.food_categories)};count++;}return count;
}
export function markDriveSeen(s:State,actor:string,day:string,ctx:Context){
 check(family.includes(actor as any),'יש לבחור פרופיל.',401);if(day!==ctx.upcoming)return false;
 const old=s.family_status[actor],same=old?.saturday===day,rev=revision(s,day);
 if(same&&old.seen_revision===rev)return false;
 s.family_status[actor]={...old,name:actor,saturday:day,seen_revision:rev,seen_at:ctx.now,approved_revision:same?old.approved_revision:-1,approved_at:same?old.approved_at:''};return true;
}
// The caller holds the Apps Script document lock; errors leave the original state unchanged.
export function driveAction(original:State,action:Action,actor:string,ctx:Context){
 const s=copy(original),day=action.saturday==='upcoming'?ctx.upcoming:action.saturday;check(validSaturday(day),'תאריך שבת לא תקין.');const a={...action,saturday:day,actor};
 check(family.includes(actor as any)||actor==='משפחה','יש לבחור פרופיל.',401);
 if(a.mutationId){check(/^[a-zA-Z0-9-]{8,80}$/.test(a.mutationId),'מזהה פעולה לא תקין.');const receipt=(s.recent_mutations||[]).find((r:any)=>r.id===a.mutationId);if(receipt){check(receipt.actor===actor,'מזהה פעולה לא תקין.',409);return {state:s,changed:false,response:{detail:'השינוי נשמר.',snapshot:driveSnapshot(s,day,ctx,false,a.compact)}};}}
 const complete=()=>{if(a.viewed)markDriveSeen(s,actor,day,ctx);if(a.mutationId){s.recent_mutations=[...(s.recent_mutations||[]),{id:a.mutationId,actor}].slice(-80);}return {state:s,changed:true,response:{detail:a.type==='seen'?'':a.type==='family_approve'?'סימנת שאהבת את התפריט.':'השינוי נשמר.',snapshot:driveSnapshot(s,day,ctx,false,a.compact)}};};
 const bumpCatalog=()=>{s.catalog_revision=Number(s.catalog_revision||0)+1;};
 const allowed=['archive_completed','transfer','assign','seen','family_unapprove','family_approve','approve','generate','move','add','replace','remove','catalog_save','catalog_remove','category_save','category_remove'];check(allowed.includes(a.type),'פעולה לא מוכרת.');
 if(a.type==='archive_completed'){const count=archiveCompletedShabbats(s,ctx);return {state:s,changed:count>0,response:{detail:'',archived:count,snapshot:driveSnapshot(s,day,ctx,false,a.compact)}};}
 if(['catalog_save','catalog_remove','category_save','category_remove'].includes(a.type)){
 check((a.catalogRevision??0)===Number(s.catalog_revision||0),'מאגר המנות השתנה. יש לרענן לפני השמירה.',409);
 check(a.revision===revision(s,day),'התפריט השתנה. יש לרענן.',409);
 if(a.type==='catalog_save'){const dish=resolve(s,a.dish!);if(a.oldName&&norm(a.oldName)!==norm(dish.name)){check(!s.dish_catalog.some((d:Dish)=>norm(d.name)===norm(dish.name)),'מנה בשם הזה כבר קיימת.');removeDish(s,a.oldName);}putDish(s,dish,actor,ctx.now);syncRecipe(s,dish,ctx);}
 if(a.type==='catalog_remove'){check(typeof a.oldName==='string'&&s.dish_catalog.some((d:Dish)=>norm(d.name)===norm(a.oldName!)),'המנה לא נמצאה.');removeDish(s,a.oldName!);}
 if(a.type==='category_save'){const id=String(a.id||'').trim(),label=categoryLabel(String(a.label||''));check(/^[a-z][a-z0-9_-]{0,49}$/.test(id)&&label&&label.length<=70,'קטגוריה לא תקינה.');check(!duplicateCategory(s.food_categories,label,id),'הקטגוריה כבר קיימת.');s.food_categories[id]=label;}
 if(a.type==='category_remove'){check(a.id&&a.id!=='extra'&&s.food_categories[a.id],'אי אפשר להסיר קטגוריה זו.');delete s.food_categories[a.id!];for(const d of s.dish_catalog)if(d.category===a.id)d.category='extra';}
 bumpCatalog();return complete();
 }
 check(a.revision===revision(s,day),'התפריט השתנה. יש לרענן לפני השמירה.',409);
 if((a.type==='add'||a.type==='replace'||a.type==='remove'&&a.removeFromCatalog)&&(a.compact||a.catalogRevision!==undefined))check((a.catalogRevision??0)===Number(s.catalog_revision||0),'מאגר המנות השתנה. יש לרענן לפני השמירה.',409);
 const current=copy(saved(s,day)||emptyMenu(day,s.anchor_saturday,s.anchor_week));
 if(a.type==='transfer'){
  check((a.meal==='friday'||a.meal==='lunch')&&(a.targetMeal==='friday'||a.targetMeal==='lunch'),'ארוחה לא תקינה.');
  check(a.targetSaturday===day||a.targetSaturday===addDays(day,7),'אפשר להעביר רק לשבת הזו או לשבת הבאה.');
  check(a.targetSaturday!==day||a.targetMeal!==a.meal,'המנה כבר בארוחה הזו.');
  check(Number.isInteger(a.index)&&a.index!==undefined&&a.index>=0,'מיקום מנה לא תקין.');
  let dish=current[a.meal!].dishes[a.index!];check(dish,'המנה כבר הוסרה.');
  if(a.responsible!==undefined)dish=editMenu(current,{...a,type:'assign'})[a.meal!].dishes[a.index!];
  let target=a.targetSaturday===day?current:copy(saved(s,a.targetSaturday!)||generateDriveMenu(s,a.targetSaturday!,ctx));
  check(mealAllows(inferDiet(dish!.name),a.targetMeal!,target.week),'המנה אינה מתאימה לארוחה בשרית או חלבית.');
  check(!target[a.targetMeal!].dishes.some(d=>d&&norm(d.name)===norm(dish!.name)),'המנה כבר מופיעה בארוחת היעד.');
  const source=editMenu(current,{...a,type:'remove'});if(a.targetSaturday===day)target=source;
  target=editMenu(target,{...a,type:'add',meal:a.targetMeal,dish:dish!});
  const inserted=target[a.targetMeal!].dishes.find(d=>d&&norm(d.name)===norm(dish!.name));if(dish!.prepared_by)inserted!.prepared_by=dish!.prepared_by;
  s.menu_drafts[day]=a.targetSaturday===day?target:source;s.menu_revisions[day]=revision(s,day)+1;
  if(a.targetSaturday!==day){s.menu_drafts[a.targetSaturday!]=target;s.menu_revisions[a.targetSaturday!]=revision(s,a.targetSaturday!)+1;}
  return complete();
 }
 if(a.type==='seen'||a.type==='family_approve'||a.type==='family_unapprove'){
 check(day===ctx.upcoming,'צפיות ואהבות זמינות לשבת הקרובה בלבד.');const old=s.family_status[actor];const same=old?.saturday===day;
 if(a.type==='seen'&&old?.saturday===day&&old.seen_revision===revision(s,day))return {state:s,changed:false,response:{detail:'',snapshot:driveSnapshot(s,day,ctx,false,a.compact)}};
 if(a.type==='family_approve'){const approved=editMenu(current,{...a,type:'approve'});s.menu_drafts[day]=approved;approveHistory(s,approved);}
 s.family_status[actor]={name:actor,saturday:day,seen_revision:revision(s,day),seen_at:ctx.now,approved_revision:a.type==='family_unapprove'?-1:a.type==='family_approve'?revision(s,day):same?old.approved_revision:-1,approved_at:a.type==='family_unapprove'?'':a.type==='family_approve'?ctx.now:same?old.approved_at:''};
 }else{
 let menu:Menu;if(a.type==='generate'){check(!saved(s,day),'כבר קיים תפריט לשבת הזאת.');menu=generateDriveMenu(s,day,ctx);}else{
 if(a.type==='add'||a.type==='replace'){a.dish=resolve(s,a.dish!);check(mealAllows(inferDiet(a.dish.name),a.meal!,current.week),'המנה אינה מתאימה לארוחה בשרית או חלבית.');}
 menu=editMenu(current,a);
 if((a.type==='add'||a.type==='replace')&&a.dish?.recipe_url!==undefined)for(const d of [...menu.friday.dishes,...menu.lunch.dishes])if(d&&norm(d.name)===norm(a.dish.name))d.recipe_url=a.dish.recipe_url;
 if(a.type==='add'||a.type==='replace'){putDish(s,a.dish!,actor,ctx.now);syncRecipe(s,a.dish!,ctx,day);bumpCatalog();}
 if(a.type==='remove'&&a.removeFromCatalog){const old=current[a.meal!].dishes[a.index!];if(old){removeDish(s,old.name);bumpCatalog();}}
 }
 s.menu_drafts[day]=menu;s.menu_revisions[day]=revision(s,day)+1;if(menu.approved)approveHistory(s,menu);
 }
 return complete();
}
export function mergeSiteExport(original:State,exported:any,ctx:Context){
 const s=copy(original);if(s.site_migration_v2)return s;check(exported?.format==='tiko-site-export-v1','קובץ העברה לא תקין.');
 const importedDates=new Set<string>();for(const row of exported.menus||[]){const menu=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;check(validSaturday(menu.saturday),'תאריך העברה לא תקין.');const existing=saved(s,menu.saturday);if(existing){const automaticDraft=menu.saturday===ctx.upcoming&&!existing.approved&&revision(s,menu.saturday)<=1&&Number(row.revision)>1&&![...existing.friday.dishes,...existing.lunch.dishes].filter(Boolean).some(d=>d!.updated_by&&d!.updated_by!=='אוטומטית');if(!automaticDraft)continue;s.migration_conflicts||=[];s.migration_conflicts.push({saturday:menu.saturday,drive:copy(existing),site:copy(menu),resolved:'newer-site-edits',at:ctx.now});}s.menu_drafts[menu.saturday]=copy(menu);s.menu_revisions[menu.saturday]=Number(row.revision||0);if(menu.approved)approveHistory(s,menu);importedDates.add(menu.saturday);}
 for(const row of exported.food_categories||[])if(row.label&&!s.food_categories[row.id])s.food_categories[row.id]=row.label;
 const blocked=new Set(s.excluded_dishes.map(norm));for(const row of exported.catalog||[]){if(blocked.has(norm(row.name)))continue;const existing=s.dish_catalog.find((d:Dish)=>norm(d.name)===norm(row.name));if(!existing||row.updated_at&&row.updated_at>(existing.updated_at||''))putDish(s,resolve(s,row),row.updated_by||'משפחה',row.updated_at||ctx.now);}
 for(const row of exported.food_categories||[])if(row.label&&!s.food_categories[row.id])s.food_categories[row.id]=row.label;
 for(const row of exported.excluded_dishes||[])removeDish(s,row.name);
 for(const row of exported.family_status||[])if(importedDates.has(row.saturday))s.family_status[row.name]=copy(row);
 s.site_migration_v1||={at:ctx.now,imported_dates:[...importedDates]};s.site_migration_v2={at:ctx.now,imported_dates:[...importedDates]};return s;
}
