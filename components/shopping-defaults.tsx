'use client';
import {useState} from 'react';
import {Check,Plus} from 'lucide-react';
import {shoppingCategories,shoppingName,type ShoppingProduct,type ShoppingItem,type ShoppingImportItem} from '@/lib/shopping';
import {defaultShoppingChoices} from '@/lib/shopping-defaults';

export function ShoppingDefaults({products,items,onAdd}:{products:ShoppingProduct[];items:ShoppingItem[];onAdd:(items:ShoppingImportItem[])=>Promise<boolean>}){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState<string[]>([]),[saving,setSaving]=useState(false);
 const choices=defaultShoppingChoices(products);
 const active=new Set(items.filter(i=>!i.bought).map(i=>shoppingName(products.find(p=>p.id===i.productId)?.name||'')));
 const chosen=choices.filter(p=>selected.includes(shoppingName(p.name))&&!active.has(shoppingName(p.name)));
 return <div className="shopping-defaults">
  <button type="button" className="shopping-defaults-trigger" aria-expanded={open} aria-controls="shopping-default-choices" onClick={()=>setOpen(value=>!value)}>מהרשימה הקבועה <Plus size={17}/></button>
  {open&&<div id="shopping-default-choices" className="shopping-default-choices">
   {Object.entries(shoppingCategories).map(([category,label])=>{
    const group=choices.filter(p=>p.category===category);return group.length>0&&<fieldset key={category}><legend>{label}</legend>{group.map(product=>{
     const key=shoppingName(product.name),present=active.has(key),checked=present||selected.includes(key);
     return <label className={`shopping-default-choice ${checked?'is-selected':''}`} key={key}><input type="checkbox" checked={checked} disabled={saving||present||!checked&&chosen.length>=80} onChange={event=>setSelected(values=>event.target.checked?[...values,key]:values.filter(value=>value!==key))}/><span>{product.name}</span><small>{present?<><Check size={13}/> ברשימה</>:checked?'כן':'לא'}</small></label>;
    })}</fieldset>;
   })}
   <button className="shopping-primary" type="button" disabled={saving||!chosen.length} onClick={async()=>{
    setSaving(true);
    try{if(await onAdd(chosen.map(p=>({...p,quantity:''})))){setSelected([]);setOpen(false);}}finally{setSaving(false);}
   }}>{saving?'שומרים…':`הוספת ${chosen.length} מוצרים`}</button>
  </div>}
 </div>;
}
