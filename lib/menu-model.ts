import {recipeUrl} from './recipe-url.ts';
import { family,inferCategory } from './family.ts';
export type Dish = { name: string; category: string; updated_by?: string; updated_at?: string; prepared_by?: string; recipe_url?: string };
export type Meal = { date: string; dishes: (Dish | null)[]; slot_categories?: string[]; manual_order?: boolean };
export type Menu = { saturday: string; week: 1 | 2 | 3; friday: Meal; lunch: Meal; sent?: boolean; approved?: boolean; approved_at?: string; layout_version?: number };
export type Action = { compact?: boolean; viewed?: boolean; catalogRevision?: number; mutationId?: string; toIndex?: number; targetSaturday?: string; targetMeal?: 'friday'|'lunch'; responsible?: string; type: 'transfer' | 'assign' | 'generate' | 'replace' | 'remove' | 'add' | 'approve' | 'move' | 'seen' | 'family_approve' | 'family_unapprove' | 'archive_completed' | 'catalog_save' | 'catalog_remove' | 'category_save' | 'category_remove'; saturday: string; meal?: 'friday' | 'lunch'; index?: number; dish?: Dish; removeFromCatalog?: boolean; category?: string; revision?: number; actor?: string; diet?: string; oldName?: string; id?: string; label?: string };
export const categories = { friday: ['soup','salad','salad','baked','pasta','pastry','dessert'], lunch: ['salad','salad','baked','main','side','dessert'] };
export function addDays(day: string, amount: number) {
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0,10);
}
export function upcomingSaturday(now = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, (6 - weekday + 7) % 7 || 7);
}
export function validSaturday(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10) === day && parsed.getUTCDay() === 6 && day >= '2000-01-01';
}
export function emptyMenu(saturday: string, anchor: string, anchorWeek: number): Menu {
  const delta = Math.round((new Date(`${saturday}T12:00:00Z`).getTime()-new Date(`${anchor}T12:00:00Z`).getTime())/604800000);
  const week = (((delta+anchorWeek-1)%3+3)%3+1) as 1|2|3;
  return { saturday,week,friday:{date:addDays(saturday,-1),dishes:[]},lunch:{date:saturday,dishes:[]} };
}
export function editMenu(source: Menu, action: Action): Menu {
  const menu = structuredClone(source);
  if (action.type === 'approve') {
    if (![...menu.friday.dishes,...menu.lunch.dishes].some(Boolean) || [...menu.friday.dishes,...menu.lunch.dishes].some(x=>!x)) throw Error('יש להשלים את המנות לפני האישור.');
    menu.approved = true; menu.approved_at = new Date().toISOString(); return menu;
  }
  if (action.meal !== 'friday' && action.meal !== 'lunch') throw Error('ארוחה לא תקינה.');
  const meal = menu[action.meal];
  if(action.type==='assign'){
    const index=action.index;if(!Number.isInteger(index)||index===undefined||index<0||!meal.dishes[index])throw Error('מיקום מנה לא תקין.');
    if(action.responsible!==''&&!family.includes(action.responsible as any))throw Error('יש לבחור בן משפחה.');
    if(action.responsible)meal.dishes[index]!.prepared_by=action.responsible;else delete meal.dishes[index]!.prepared_by;
    menu.approved=false;delete menu.approved_at;return menu;
  }
  if(action.type==='move'){
    const from=action.index,to=action.toIndex;
    if(!Number.isInteger(from)||!Number.isInteger(to)||from===undefined||to===undefined||from<0||to<0||from>=meal.dishes.length||to>=meal.dishes.length||from===to)throw Error('מיקום מנה לא תקין.');
    meal.slot_categories ||= meal.dishes.map(d=>d?.category||'extra');
    const [dish]=meal.dishes.splice(from,1),[category]=meal.slot_categories.splice(from,1);meal.dishes.splice(to,0,dish);meal.slot_categories.splice(to,0,category);meal.manual_order=true;
    menu.approved=false;delete menu.approved_at;return menu;
  }
  const index = action.type === 'add' ? meal.dishes.length : action.index;
  if (!Number.isInteger(index) || index === undefined || index < 0 || index >= meal.dishes.length + (action.type === 'add' ? 1 : 0)) throw Error('מיקום מנה לא תקין.');
  if (action.type === 'add' && meal.dishes.length >= 20) throw Error('אפשר להוסיף עד 20 מנות לארוחה.');
  meal.slot_categories ||= meal.dishes.map((d,i)=>d?.category || categories[action.meal!][i] || 'extra');
  if (action.type === 'remove') {
    if (!meal.dishes[index]) throw Error('המנה כבר הוסרה.');
    meal.dishes.splice(index,1); meal.slot_categories.splice(index,1);
  } else if (action.type === 'add' || action.type === 'replace') {
    const name = String(action.dish?.name || '').trim();
    if (!name || name.length > 100) throw Error('כתבי שם מנה עד 100 תווים.');
    const category = action.dish?.category && action.dish.category !== 'auto' ? action.dish.category : inferCategory(name);
    const dish: Dish = {name,category,updated_by:action.actor,updated_at:new Date().toISOString()};
    if(action.dish?.recipe_url!==undefined)dish.recipe_url=recipeUrl(action.dish.recipe_url);
    else if(action.type==='replace'&&meal.dishes[index]?.name===name&&meal.dishes[index]?.recipe_url)dish.recipe_url=meal.dishes[index]!.recipe_url;
    if(action.responsible!==undefined){if(action.responsible!==''&&!family.includes(action.responsible as any))throw Error('יש לבחור בן משפחה.');if(action.responsible)dish.prepared_by=action.responsible;}
    if (action.type === 'add') {
      let target=meal.dishes.length;
      if(!meal.manual_order&&category!=='dessert'){const dessert=meal.dishes.findIndex(d=>d?.category==='dessert');if(dessert>=0)target=dessert;if(action.meal==='friday'&&category==='soup')target=0;}
      meal.dishes.splice(target,0,dish);meal.slot_categories.splice(target,0,category);
    } else { if(action.responsible===undefined&&meal.dishes[index]?.prepared_by)dish.prepared_by=meal.dishes[index]!.prepared_by;meal.dishes[index] = dish; meal.slot_categories[index] = category; }
  } else throw Error('פעולה לא מוכרת.');
  menu.approved = false; delete menu.approved_at;
  return menu;
}
