import type {ShoppingAction,ShoppingState} from './shopping.ts';

type Addition=Omit<ShoppingAction,'mutationId'|'revision'>;
const key=(name:string)=>name.normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('he');

// Check the visible state, including pending saves, and earlier accepted scan rows.
// The catalog alone is not an active-list duplicate.
export function confirmShoppingAddition(state:ShoppingState,action:Addition,confirm:(message:string)=>boolean):Addition|null {
 if(action.type!=='shopping_add'&&action.type!=='shopping_import')return action;
 const present=new Map<string,{bought:boolean;quantity:string}>();
 for(const item of state.items){const product=state.products.find(p=>p.id===item.productId);if(product)present.set(key(product.name),item);}
 const accept=(name:string,quantity?:string)=>{
  const existing=present.get(key(name));
  if(existing){
   const details=[existing.bought?'המוצר כבר סומן כנקנה.':'',existing.quantity?`הכמות ברשימה: ${existing.quantity}.`:'',quantity!==undefined?`הכמות תעודכן ל: ${quantity.trim()||'ללא כמות'}.`:'הכמות הקיימת תישמר.'].filter(Boolean).join('\n');
   if(!confirm(`״${name.trim()}״ — המוצר כבר ברשימה. האם להוסיף בכל זאת?\n${details}\nאישור יעדכן את השורה הקיימת ויעביר אותה למוצרים שצריך לקנות.`))return false;
  }
  present.set(key(name),{bought:false,quantity:quantity?.trim()??existing?.quantity??''});return true;
 };
 if(action.type==='shopping_import'){
  const items=action.items?.filter(item=>accept(item.name,item.quantity))||[];
  return items.length?{...action,items}:null;
 }
 const name=action.productId?state.products.find(p=>p.id===action.productId)?.name:action.name;
 return name&&accept(name,action.quantity)?action:null;
}
