import {recipeUrl} from './recipe-url.ts';
import {editMenu,type Action,type Dish,type Menu} from './menu-model.ts';
import {inferCategory,inferDiet,mealAllows} from './family.ts';
export type MutationSnapshot={current:Menu|null;revision?:number;catalog_revision?:number;upcoming_saturday?:string;catalog?:Dish[];categories?:Record<string,string>;family_status?:{name:string;saturday:string;seen_revision:number;approved_revision:number;seen_at:string}[]};
const norm=(s:string)=>s.normalize('NFKC').replace(/\([^)]*\)/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().toLowerCase();
export function projectAction<S extends MutationSnapshot>(source:S,action:Action):S{
 const s={...source},a={...action},now=new Date().toISOString(),actor=a.actor||'משפחה';
 const catalogActions=['catalog_save','catalog_remove','category_save','category_remove'];
 const resolve=(dish?:Dish)=>{const name=String(dish?.name||'').trim();if(!name||name.length>100)throw Error('יש לכתוב שם מנה עד 100 תווים.');const id=dish?.category&&dish.category!=='auto'?dish.category:inferCategory(name);const link=dish?.recipe_url!==undefined?recipeUrl(dish.recipe_url):s.catalog?.find(d=>norm(d.name)===norm(name))?.recipe_url;return {...(link!==undefined?{recipe_url:link}:{}),name,category:s.categories&&!s.categories[id]?'extra':id,diet:inferDiet(name),updated_by:actor,updated_at:now};};
 const put=(dish:Dish)=>{s.catalog=[...(s.catalog||[]).filter(d=>norm(d.name)!==norm(dish.name)),dish].sort((a,b)=>a.name.localeCompare(b.name,'he'));};
 if(catalogActions.includes(a.type)){
  if(a.type==='catalog_save'){const dish=resolve(a.dish);if(a.oldName&&norm(a.oldName)!==norm(dish.name)){if(s.catalog?.some(d=>norm(d.name)===norm(dish.name)))throw Error('מנה בשם הזה כבר קיימת.');s.catalog=s.catalog?.filter(d=>norm(d.name)!==norm(a.oldName!));}put(dish);if(s.current&&s.current.saturday>=(s.upcoming_saturday||a.saturday)){let changed=false;const menu=structuredClone(s.current);for(const d of [...menu.friday.dishes,...menu.lunch.dishes])if(d&&norm(d.name)===norm(dish.name)&&dish.recipe_url!==undefined&&(d.recipe_url||'')!==dish.recipe_url){d.recipe_url=dish.recipe_url;changed=true;}if(changed){menu.approved=false;delete menu.approved_at;s.current=menu;s.revision=(s.revision||0)+1;}}}
  if(a.type==='catalog_remove')s.catalog=s.catalog?.filter(d=>norm(d.name)!==norm(a.oldName||''));
  if(a.type==='category_save'){if(!a.label?.trim())throw Error('יש לכתוב שם קטגוריה.');s.categories={...s.categories,[a.id!]:a.label.trim()};}
  if(a.type==='category_remove'){s.categories={...s.categories};delete s.categories[a.id!];s.catalog=s.catalog?.map(d=>d.category===a.id?{...d,category:'extra'}:d);}
  s.catalog_revision=(s.catalog_revision||0)+1;return s;
 }
 if(!s.current||s.current.saturday!==a.saturday)throw Error('יש לרענן את התפריט לפני השמירה.');
 if(a.type==='transfer'){
  let dish=s.current[a.meal!].dishes[a.index!];if(!dish)throw Error('המנה כבר הוסרה.');
  if(a.responsible!==undefined)dish=editMenu(s.current,{...a,type:'assign'})[a.meal!].dishes[a.index!]!;
  if(a.targetSaturday===a.saturday){
   if(a.targetMeal===a.meal)throw Error('המנה כבר בארוחה הזו.');
   if(!mealAllows(inferDiet(dish.name),a.targetMeal!,s.current.week))throw Error('המנה אינה מתאימה לארוחה בשרית או חלבית.');
   if(s.current[a.targetMeal!].dishes.some(d=>d&&norm(d.name)===norm(dish.name)))throw Error('המנה כבר מופיעה בארוחת היעד.');
  }
  s.current=editMenu(s.current,{...a,type:'remove'});
  if(a.targetSaturday===a.saturday){s.current=editMenu(s.current,{...a,type:'add',meal:a.targetMeal,dish});const inserted=s.current[a.targetMeal!].dishes.find(d=>d&&norm(d.name)===norm(dish.name));if(dish.prepared_by)inserted!.prepared_by=dish.prepared_by;}
  s.revision=(s.revision||0)+1;return s;
 }
 if(a.type==='seen'||a.type==='family_approve'||a.type==='family_unapprove'){
  if(a.type==='family_approve')s.current=editMenu(s.current,{...a,type:'approve'});
 }else{
  if(a.type==='replace'||a.type==='add'){const dish=resolve(a.dish);if(!mealAllows(dish.diet,a.meal!,s.current.week))throw Error('המנה אינה מתאימה לארוחה בשרית או חלבית.');a.dish=dish;put(dish);s.catalog_revision=(s.catalog_revision||0)+1;}
  if(a.type==='remove'&&a.removeFromCatalog){const removed=s.current[a.meal!].dishes[a.index!];s.catalog=s.catalog?.filter(d=>norm(d.name)!==norm(removed?.name||''));s.catalog_revision=(s.catalog_revision||0)+1;}
  s.current=editMenu(s.current,a);if((a.type==='add'||a.type==='replace')&&a.dish?.recipe_url!==undefined)for(const d of [...s.current.friday.dishes,...s.current.lunch.dishes])if(d&&norm(d.name)===norm(a.dish.name))d.recipe_url=a.dish.recipe_url;s.revision=(s.revision||0)+1;
 }
 if(s.upcoming_saturday&&s.upcoming_saturday!==a.saturday)return s;
 const old=s.family_status?.find(x=>x.name===actor&&x.saturday===a.saturday);
 s.family_status=[...(s.family_status||[]).filter(x=>x.name!==actor),{...old,name:actor,saturday:a.saturday,seen_revision:s.revision||0,seen_at:now,approved_revision:a.type==='family_unapprove'?-1:a.type==='family_approve'?s.revision||0:old?.approved_revision??-1}];
 return s;
}
