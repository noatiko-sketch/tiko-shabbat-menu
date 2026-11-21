import {inferDiet,mealAllows,type MealType} from './family.ts';
import type {Dish} from './menu-model.ts';
// A missing category means adding a new slot, which may use any compatible dish.
export function dishCandidates(catalog:Dish[],meal:'friday'|'lunch',week:number,category?:string,selected?:MealType){
 return catalog.filter(d=>(category===undefined||d.category===category)&&mealAllows(inferDiet(d.name),meal,week,selected));
}
