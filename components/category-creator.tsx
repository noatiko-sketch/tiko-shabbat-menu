'use client';
import {useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {categoryLabel,duplicateCategory} from '@/lib/custom-categories';
export const NEW_CATEGORY='__new_category__';
export type CreateCategory=(id:string,label:string)=>Promise<boolean>;
export function CategoryCreator({open,onOpenChange,categories,onCreate,onSelect}:{open:boolean;onOpenChange:(open:boolean)=>void;categories:Record<string,string>;onCreate:CreateCategory;onSelect:(id:string)=>void}){
 const [name,setName]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const label=categoryLabel(name),existing=duplicateCategory(categories,label);
 return <Dialog open={open} onOpenChange={value=>{if(!saving){onOpenChange(value);setName('');setError('');}}}><DialogContent style={{width:'min(420px, calc(100vw - 32px))'}} dir="rtl" aria-describedby={undefined} showCloseButton={!saving}><DialogHeader><DialogTitle>קטגוריה חדשה</DialogTitle></DialogHeader><form onSubmit={async event=>{event.preventDefault();event.stopPropagation();if(saving||!label||existing)return;setSaving(true);setError('');try{const id='custom-'+(crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join(''));if(await onCreate(id,label)){onSelect(id);onOpenChange(false);setName('');}else setError('הקטגוריה לא נשמרה. יש לנסות שוב.');}catch{setError('הקטגוריה לא נשמרה. יש לנסות שוב.');}finally{setSaving(false);}}}><label className="form-label">שם הקטגוריה<input autoFocus value={name} maxLength={70} disabled={saving} onChange={event=>setName(event.target.value)}/></label>{existing&&<p role="status">הקטגוריה כבר קיימת. <button type="button" onClick={()=>{onSelect(existing);onOpenChange(false);setName('');}}>בחירה בקטגוריה הקיימת</button></p>}{error&&<p role="alert" className="form-error">{error}</p>}<div className="form-actions"><Button disabled={saving||!label||!!existing}>{saving?'שומרים…':'הוסף'}</Button><Button type="button" disabled={saving} onClick={()=>{onOpenChange(false);setName('');setError('');}}>ביטול</Button></div></form></DialogContent></Dialog>;
}
export function ShoppingCategorySelect({value,onChange,categories,onCreate,disabled=false,label='קטגוריה'}:{value:string;onChange:(value:string)=>void;categories:Record<string,string>;onCreate?:CreateCategory;disabled?:boolean;label?:string}){
 const [open,setOpen]=useState(false);
 return <><select aria-label={label} value={value} disabled={disabled} onChange={event=>event.target.value===NEW_CATEGORY?setOpen(true):onChange(event.target.value)}>{Object.entries(categories).map(([id,name])=><option key={id} value={id}>{name}</option>)}{onCreate&&<option value={NEW_CATEGORY}>＋ קטגוריה חדשה</option>}</select>{onCreate&&<CategoryCreator open={open} onOpenChange={setOpen} categories={categories} onCreate={onCreate} onSelect={onChange}/>}</>;
}
