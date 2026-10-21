import {recipeUrl} from './recipe-url.ts';
import imported from './catalog-import.json' with {type:'json'};
import {defaultCategories,inferCategory,inferDiet} from './family.ts';
import type {Dish} from './menu-model.ts';
export const normalized=(name:string)=>name.normalize('NFKC').trim().toLowerCase();
export type CatalogDish=Dish & {diet:string;updated_by:string;updated_at:string};
export async function seedCatalog(db:D1Database,extras:Dish[]=[]) {
 const initialized=await db.prepare("SELECT id FROM food_categories WHERE id='__catalog_ready_v1'").first(); if(initialized)return;
 const rows = await db.prepare('SELECT payload FROM menus').all<{payload:string}>();
 const menuDishes=rows.results.flatMap(r=>{const m=JSON.parse(r.payload);return [...m.friday.dishes,...m.lunch.dishes].filter(Boolean);});
 const blocked=await db.prepare('SELECT name FROM excluded_dishes').all<{name:string}>();
 const excluded=new Set(blocked.results.map(x=>x.name));
 const foods=[...imported,...menuDishes,...extras].filter(x=>x?.name&&!excluded.has(normalized(x.name)));
 const commands=Object.entries(defaultCategories).map(([id,label])=>db.prepare('INSERT OR IGNORE INTO food_categories (id,label) VALUES (?,?)').bind(id,label));
 for(const d of foods) commands.push(db.prepare('INSERT OR IGNORE INTO catalog (name,category,diet,updated_by,updated_at) VALUES (?,?,?,?,?)').bind(d.name,d.category==='extra'?inferCategory(d.name):d.category||inferCategory(d.name),('diet' in d && d.diet ? d.diet : inferDiet(d.name)),'',''));
 for(let i=0;i<commands.length;i+=70) await db.batch(commands.slice(i,i+70));
 await db.prepare("UPDATE catalog SET category='extra' WHERE category NOT IN (SELECT id FROM food_categories WHERE label <> '')").run();
 await db.prepare("INSERT OR IGNORE INTO food_categories (id,label) VALUES ('__catalog_ready_v1','')").run();
}
export async function catalogSnapshot(db:D1Database) {
 const [dishes,cats]=await Promise.all([db.prepare('SELECT * FROM catalog ORDER BY name').all<CatalogDish>(),db.prepare("SELECT id,label FROM food_categories WHERE label <> '' ORDER BY rowid").all<{id:string;label:string}>()]);
 return {catalog:dishes.results.map(d=>({...d,diet:inferDiet(d.name)})),categories:Object.fromEntries(cats.results.map(c=>[c.id,c.label]))};
}
export async function resolveDish(db:D1Database,dish:Dish) {
 const name=String(dish?.name||'').trim();if(!name||name.length>100) throw Error('יש לכתוב שם מנה עד 100 תווים.');
 const inferred=inferCategory(name),requested=dish.category==='auto'?inferred:dish.category||inferred;
 const row=await db.prepare("SELECT id FROM food_categories WHERE id=? AND label<>''").bind(requested).first<{id:string}>();
 return {name,category:row?.id||'extra',...(dish.recipe_url!==undefined?{recipe_url:recipeUrl(dish.recipe_url)}:{})};
}
