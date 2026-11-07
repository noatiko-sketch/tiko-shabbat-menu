'use client';
import {useState} from 'react';
import {LoaderCircle,Plus,X} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {shoppingCategories,shoppingName,type ShoppingCategory,type ShoppingProduct,type ShoppingImportItem} from '@/lib/shopping';
import {defaultShoppingChoices} from '@/lib/shopping-defaults';

type DefaultProduct={name:string;category:ShoppingCategory};
export function ShoppingDefaults({products,defaultProductIds=[],pending=false,saveError='',onAdd,onSave,onRemove}:{products:ShoppingProduct[];defaultProductIds?:string[];pending?:boolean;saveError?:string;onAdd:(items:ShoppingImportItem[])=>Promise<boolean>;onSave:(product:DefaultProduct)=>Promise<boolean>;onRemove:(name:string)=>Promise<boolean>}){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState<string[]>([]),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const [adding,setAdding]=useState(false),[name,setName]=useState(''),[category,setCategory]=useState<ShoppingCategory>('general');
 const choices=defaultShoppingChoices(products,defaultProductIds);
 const chosen=choices.filter(product=>selected.includes(product.id));
 const changeOpen=(value:boolean)=>{setOpen(value);if(!value){setSelected([]);setError('');}};
 return <Dialog open={open} onOpenChange={changeOpen}>
  <DialogTrigger asChild><button type="button" className="shopping-defaults-trigger">מהרשימה הקבועה <Plus size={17}/></button></DialogTrigger>
  <DialogContent className="shopping-default-modal" dir="rtl" showCloseButton={false} aria-describedby={undefined}>
   <header className="shopping-default-modal-header"><div className="shopping-default-modal-title"><DialogTitle>הרשימה הקבועה</DialogTitle><button type="button" className="shopping-remove" aria-label="סגירת הרשימה הקבועה" onClick={()=>changeOpen(false)}><X size={22}/></button></div>
    <button type="button" className="shopping-default-add" disabled={saving} aria-expanded={adding} onClick={()=>{if(!adding&&!saveError){setName('');setCategory('general');}setAdding(value=>!value);}}>{adding?<X size={17}/>:<Plus size={17}/>} {adding?'סגירה':'הוספת מוצר קבוע'}</button>
    {adding&&<form className="shopping-form shopping-default-form" aria-label="הוספת פריט לרשימה הקבועה" onSubmit={async event=>{
     event.preventDefault();if(saving||!name.trim())return;setSaving(true);setError('');
     try{if(await onSave({name:name.trim(),category})){setAdding(false);}else setError('הפריט לא נשמר. אפשר לנסות שוב.');}finally{setSaving(false);}
    }}>
     <label>שם המוצר<input autoFocus required maxLength={100} value={name} disabled={saving} onChange={event=>{const value=event.target.value;setName(value);setCategory(products.find(p=>shoppingName(p.name)===shoppingName(value))?.category||'general');}}/></label>
     <label>קטגוריה<select value={category} disabled={saving} onChange={event=>setCategory(event.target.value as ShoppingCategory)}>{Object.entries(shoppingCategories).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>
     <button className="shopping-primary" disabled={saving||!name.trim()} type="submit">שמירה ברשימה הקבועה</button>
    </form>}
    {pending&&<p className="shopping-default-saving" role="status"><LoaderCircle className="spin" size={14}/> שומרים…</p>}
    {(error||saveError)&&<p className="shopping-error" role="alert">{error||saveError}</p>}
   </header>
   <div className="shopping-default-modal-body" aria-busy={saving}>
    {Object.entries(shoppingCategories).map(([category,label])=>{
     const group=choices.filter(p=>p.category===category);return group.length>0&&<fieldset key={category}><legend>{label}</legend>{group.map(product=>{
      const checked=selected.includes(product.id);
      return <div className="shopping-default-row" key={product.id}>
       <label className={`shopping-default-choice ${checked?'is-selected':''}`}><input type="checkbox" checked={checked} disabled={saving||!checked&&chosen.length>=80} onChange={event=>setSelected(values=>event.target.checked?[...values,product.id]:values.filter(value=>value!==product.id))}/><span>{product.name}</span></label>
       <button className="shopping-remove" type="button" disabled={saving} aria-label={`הסרת ${product.name} מהרשימה הקבועה`} title="הסרה מהרשימה הקבועה" onClick={async()=>{
        setSaving(true);setError('');try{if(await onRemove(product.name))setSelected(values=>values.filter(value=>value!==product.id));else setError('ההסרה לא נשמרה. אפשר לנסות שוב.');}finally{setSaving(false);}
       }}><X size={17}/></button>
      </div>;
     })}</fieldset>;
    })}
    {choices.length===0&&<p className="shopping-hint">הרשימה הקבועה ריקה</p>}
   </div>
   <footer className="shopping-default-modal-footer"><button className="shopping-primary" type="button" disabled={saving||!chosen.length} onClick={async()=>{
    setSaving(true);setError('');
    try{if(await onAdd(chosen.map(p=>({name:p.name,category:p.category,quantity:''})))){changeOpen(false);}else setError('המוצרים לא נשמרו. אפשר לנסות שוב.');}finally{setSaving(false);}
   }}>{saving?'שומרים…':`הוסף את המוצרים הנבחרים${chosen.length?` (${chosen.length})`:''}`}</button></footer>
  </DialogContent>
 </Dialog>;
}
