'use client';
import {useState} from 'react';
import {Check,Plus,X} from 'lucide-react';
import {shoppingCategories,shoppingName,type ShoppingCategory,type ShoppingProduct,type ShoppingItem,type ShoppingImportItem} from '@/lib/shopping';
import {defaultShoppingChoices} from '@/lib/shopping-defaults';

type DefaultProduct={name:string;category:ShoppingCategory};
export function ShoppingDefaults({products,items,hiddenDefaults=[],onAdd,onSave,onRemove}:{products:ShoppingProduct[];items:ShoppingItem[];hiddenDefaults?:string[];onAdd:(items:ShoppingImportItem[])=>Promise<boolean>;onSave:(product:DefaultProduct)=>Promise<boolean>;onRemove:(name:string)=>Promise<boolean>}){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState<string[]>([]),[saving,setSaving]=useState(false);
 const [adding,setAdding]=useState(false),[name,setName]=useState(''),[category,setCategory]=useState<ShoppingCategory>('general');
 const choices=defaultShoppingChoices(products,hiddenDefaults);
 const active=new Set(items.filter(i=>!i.bought).map(i=>shoppingName(products.find(p=>p.id===i.productId)?.name||'')));
 const chosen=choices.filter(p=>selected.includes(shoppingName(p.name))&&!active.has(shoppingName(p.name)));
 return <div className="shopping-defaults">
  <button type="button" className="shopping-defaults-trigger" aria-expanded={open} aria-controls="shopping-default-choices" onClick={()=>setOpen(value=>!value)}>מהרשימה הקבועה <Plus size={17}/></button>
  {open&&<div id="shopping-default-choices" className="shopping-default-choices" aria-busy={saving}>
   <button type="button" className="shopping-default-add" disabled={saving} aria-expanded={adding} onClick={()=>setAdding(value=>!value)}>{adding?<X size={17}/>:<Plus size={17}/>} {adding?'סגירה':'הוספת פריט קבוע'}</button>
   {adding&&<form className="shopping-form shopping-default-form" aria-label="הוספת פריט לרשימה הקבועה" onSubmit={async event=>{
    event.preventDefault();if(saving||!name.trim())return;setSaving(true);
    try{if(await onSave({name:name.trim(),category})){setName('');setCategory('general');setAdding(false);}}finally{setSaving(false);}
   }}>
    <label>שם הפריט<input autoFocus required maxLength={100} value={name} disabled={saving} onChange={event=>{const value=event.target.value;setName(value);setCategory(products.find(p=>shoppingName(p.name)===shoppingName(value))?.category||'general');}}/></label>
    <label>קטגוריה<select value={category} disabled={saving} onChange={event=>setCategory(event.target.value as ShoppingCategory)}>{Object.entries(shoppingCategories).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>
    <button className="shopping-primary" disabled={saving||!name.trim()} type="submit">שמירה ברשימה הקבועה</button>
   </form>}
   {Object.entries(shoppingCategories).map(([category,label])=>{
    const group=choices.filter(p=>p.category===category);return group.length>0&&<fieldset key={category}><legend>{label}</legend>{group.map(product=>{
     const key=shoppingName(product.name),present=active.has(key),checked=present||selected.includes(key);
     return <div className="shopping-default-row" key={key}>
      <label className={`shopping-default-choice ${checked?'is-selected':''}`}><input type="checkbox" checked={checked} disabled={saving||present||!checked&&chosen.length>=80} onChange={event=>setSelected(values=>event.target.checked?[...values,key]:values.filter(value=>value!==key))}/><span>{product.name}</span><small>{present?<><Check size={13}/> ברשימה</>:checked?'כן':'לא'}</small></label>
      <button className="shopping-remove" type="button" disabled={saving} aria-label={`הסרת ${product.name} מהרשימה הקבועה`} title="הסרה מהרשימה הקבועה" onClick={async()=>{
       setSaving(true);try{if(await onRemove(product.name))setSelected(values=>values.filter(value=>value!==key));}finally{setSaving(false);}
      }}><X size={17}/></button>
     </div>;
    })}</fieldset>;
   })}
   {choices.length===0&&<p className="shopping-hint">הרשימה הקבועה ריקה</p>}
   <button className="shopping-primary" type="button" disabled={saving||!chosen.length} onClick={async()=>{
    setSaving(true);
    try{if(await onAdd(chosen.map(p=>({...p,quantity:''})))){setSelected([]);setOpen(false);}}finally{setSaving(false);}
   }}>{saving?'שומרים…':`הוספת ${chosen.length} מוצרים`}</button>
  </div>}
 </div>;
}
