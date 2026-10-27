import {family} from './family.ts';

export const shoppingCategories = {
 produce:'ירקות ופירות', cleaning:'מוצרי ניקוי', legumes:'קטניות', cereal:'דגני בוקר',
 dairy:'מוצרי חלב', fresh:'דגים, בשר ועוף טריים', water:'מים', frozen:'קפואים', canned:'שימורים', general:'כללי',
} as const;
export type ShoppingCategory = keyof typeof shoppingCategories;
export type ShoppingProduct = {id:string;name:string;category:ShoppingCategory};
export type ShoppingItem = {productId:string;quantity:string;bought:boolean;updated_by:string;updated_at:string};
export type ShoppingState = {revision:number;products:ShoppingProduct[];items:ShoppingItem[];receipts:{id:string;actor:string}[]};
export type ShoppingImportItem = {name:string;category:ShoppingCategory;quantity:string};
export type ShoppingAction = {type:'shopping_add'|'shopping_toggle'|'shopping_remove'|'shopping_clear_bought'|'shopping_recategorize'|'shopping_import';mutationId:string;revision?:number;productId?:string;name?:string;category?:string;quantity?:string;bought?:boolean;items?:ShoppingImportItem[]};
export type ShoppingSnapshot = {status:'ready';storage:'google-drive';state_id:string;shopping:ShoppingState};
export class ShoppingError extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
const shoppingCheck=(ok:unknown,message:string,status=400)=>{if(!ok)throw new ShoppingError(message,status);};
const shoppingName=(name:string)=>name.normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('he');
export function readShopping(state:Record<string,any>):ShoppingState {
 return state.shopping ? structuredClone(state.shopping) : {revision:0,products:[],items:[],receipts:[]};
}
export function shoppingSnapshot(state:Record<string,any>):ShoppingSnapshot {
 // Mutation receipts stay on the server; clients only need the current revision.
 return {status:'ready',storage:'google-drive',state_id:'1wc9VbyXuLl9QTWVPLUYiU1vUQjz1vmZI',shopping:{...readShopping(state),receipts:[]}};
}
export function editShopping(source:ShoppingState,action:ShoppingAction,actor:string,now:string):ShoppingState {
 shoppingCheck(family.includes(actor as any),'יש לבחור פרופיל.',401);
 shoppingCheck(typeof action.mutationId==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(action.mutationId),'מזהה פעולה לא תקין.');
 if(action.type==='shopping_import'){
  shoppingCheck(Array.isArray(action.items)&&action.items.length>0&&action.items.length<=80,'יש לבחור בין מוצר אחד ל־80 מוצרים.');
  shoppingCheck(action.mutationId.length<=70,'מזהה ייבוא לא תקין.');
  let next=source;
  for(const [index,item] of action.items!.entries()){
   shoppingCheck(item&&typeof item==='object','מוצר לא תקין.');
   next=editShopping(next,{type:'shopping_add',name:item.name,category:item.category,quantity:item.quantity,mutationId:action.mutationId+'-'+index},actor,now);
  }
  next.revision=source.revision+1;return next;
 }
 const s=structuredClone(source);
 if(action.type==='shopping_add'){
  let product=s.products.find(p=>p.id===action.productId);
  if(!action.productId){
   shoppingCheck(typeof action.name==='string','יש לכתוב שם מוצר.');
   const name=action.name!.replace(/\s+/g,' ').trim();
   shoppingCheck(name.length>0&&name.length<=100,'יש לכתוב שם מוצר עד 100 תווים.');
   shoppingCheck(Object.prototype.hasOwnProperty.call(shoppingCategories,action.category||''),'יש לבחור קטגוריה.');
   product=s.products.find(p=>shoppingName(p.name)===shoppingName(name));
   if(!product){
    shoppingCheck(s.products.length<2000,'המאגר מכיל כבר 2,000 מוצרים.');
    product={id:'p-'+action.mutationId,name,category:action.category as ShoppingCategory};s.products.push(product);
   }
  }
  shoppingCheck(product,'המוצר אינו במאגר. יש לרענן את הרשימה.');
  shoppingCheck(action.quantity===undefined||typeof action.quantity==='string'&&action.quantity.length<=60,'כמות ארוכה מדי — עד 60 תווים.');
  const item=s.items.find(i=>i.productId===product!.id);
  const quantity=action.quantity?.trim()??item?.quantity??'';
  if(item)Object.assign(item,{quantity,bought:false,updated_by:actor,updated_at:now});
  else {shoppingCheck(s.items.length<500,'אפשר להוסיף עד 500 מוצרים לרשימה.');s.items.push({productId:product!.id,quantity,bought:false,updated_by:actor,updated_at:now});}
 }else if(action.type==='shopping_toggle'||action.type==='shopping_remove'){
  const item=s.items.find(i=>i.productId===action.productId);shoppingCheck(item,'המוצר כבר הוסר מהרשימה. יש לרענן.');
  if(action.type==='shopping_toggle'){
   shoppingCheck(typeof action.bought==='boolean','סימון קנייה לא תקין.');
   Object.assign(item!,{bought:action.bought,updated_by:actor,updated_at:now});
  }else s.items=s.items.filter(i=>i.productId!==action.productId);
 }else if(action.type==='shopping_clear_bought')s.items=s.items.filter(i=>!i.bought);
 else if(action.type==='shopping_recategorize'){
  const product=s.products.find(p=>p.id===action.productId);shoppingCheck(product,'המוצר אינו במאגר.');
  shoppingCheck(Object.prototype.hasOwnProperty.call(shoppingCategories,action.category||''),'יש לבחור קטגוריה.');
  product!.category=action.category as ShoppingCategory;
 }
 else throw new ShoppingError('פעולת קניות לא מוכרת.');
 s.revision++;return s;
}
export function shoppingAction(original:Record<string,any>,action:ShoppingAction,actor:string,now:string){
 shoppingCheck(family.includes(actor as any),'יש לבחור פרופיל.',401);
 const current=readShopping(original),receipt=current.receipts.find(r=>r.id===action.mutationId);
 if(receipt){shoppingCheck(receipt.actor===actor,'מזהה פעולה לא תקין.',409);return {state:original,changed:false,response:{snapshot:shoppingSnapshot(original)}};}
 shoppingCheck(action.revision===current.revision,'רשימת הקניות השתנתה אצל בן משפחה אחר. יש לנסות שוב לאחר הרענון.',409);
 const next=editShopping(current,action,actor,now);
 next.receipts=[...next.receipts,{id:action.mutationId,actor}].slice(-80);
 const state={...original,shopping:next};
 return {state,changed:true,response:{snapshot:shoppingSnapshot(state)}};
}

// A bounded daily allowance in the existing locked Drive file, not an isolate-local counter.
// A failed provider call still consumes its reservation; replays cannot bypass the limit.
export function reserveShoppingScan(original:Record<string,any>,mutationId:string,actor:string,now:string){
 shoppingCheck(family.includes(actor as any),'יש לבחור פרופיל.',401);
 shoppingCheck(typeof mutationId==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(mutationId),'מזהה צילום לא תקין.');
 const day=now.slice(0,10),previous=original.shopping_scan_usage;
 const requests:{id:string;actor:string}[]=previous?.day===day?previous.requests:[];
 shoppingCheck(Array.isArray(requests),'מונה הצילומים דורש בדיקה.',503);
 shoppingCheck(!requests.some(r=>r.id===mutationId),'הצילום כבר נשלח לפענוח. יש להתחיל צילום חדש.',409);
 shoppingCheck(requests.length<30,'הגעתם למכסת 30 הצילומים המשפחתית להיום. אפשר להוסיף מוצרים ידנית.',429);
 const state={...original,shopping_scan_usage:{day,requests:[...requests,{id:mutationId,actor}]}};
 return {state,changed:true,response:{snapshot:shoppingSnapshot(state),scan_reserved:true}};
}
