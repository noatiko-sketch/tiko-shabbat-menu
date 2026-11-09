'use client';
import type {CreateCategory} from '@/components/category-creator';
import {useState,type ReactNode} from 'react';
import {Plus,LoaderCircle,ChevronDown,Check,Trash2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {CategoryBadge,CategorySelect,PreparationPicker} from '@/components/family-tools';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {Command,CommandInput,CommandList,CommandEmpty,CommandItem} from '@/components/ui/command';
import {RecipeField} from '@/components/recipe';
import type {Dish} from '@/lib/menu-model';
export function DishEditor({current,candidates,busy,error,onSave,onCancel,transfer,onRemove,categories={},adding=false,onCreateCategory}:{onCreateCategory?:CreateCategory;categories?:Record<string,string>;adding?:boolean;transfer?:(dirty:boolean,responsible:string)=>ReactNode;onRemove?:()=>void;current?:Dish|null;candidates:Dish[];busy:boolean;error:string;onSave:(dish:Dish,responsible:string)=>Promise<void>;onCancel:()=>void}){
 const [creating,setCreating]=useState(false),[selected,setSelected]=useState(current?.name||''),[name,setName]=useState(''),[open,setOpen]=useState(false),[category,setCategory]=useState(current?.category||''),[responsible,setResponsible]=useState(current?.prepared_by||''),[recipe,setRecipe]=useState(current?.recipe_url||'');
 const choices=adding?candidates.filter(d=>d.category===category):candidates;
 const chosen=choices.find(d=>d.name===selected)||(current?.name===selected?current:undefined);
 const dish=creating?{name:name.trim(),category:category||'auto',recipe_url:recipe.trim()}:chosen?{...chosen,recipe_url:recipe.trim()}:undefined;
 const transferDirty=creating||selected!==(current?.name||'')||recipe.trim()!==(current?.recipe_url||'');
 const dirty=!!dish&&(adding||dish.name!==current?.name||dish.category!==current?.category||responsible!==(current?.prepared_by||'')||recipe.trim()!==(current?.recipe_url||''));
 const canChoose=!adding||!!category;
 return <form className="inline-dish-editor focused-editor" aria-label={adding?'הוספת מנה':'עריכת מנה'} aria-busy={busy} onSubmit={e=>{e.preventDefault();if(!busy&&!open&&dish&&dirty)void onSave(dish,responsible);}}>
  <div className="editor-heading"><h3>{adding?'הוספת מנה':'עריכת מנה'}</h3>{onRemove&&<button type="button" className="icon-action editor-remove" disabled={busy} title="הסרת המנה" aria-label={`הסרת ${current?.name||'מנה'}`} onClick={onRemove}><Trash2 size={17}/></button>}</div>
  {(adding||creating)&&<CategorySelect value={category} onChange={value=>{setCategory(value);setSelected('');setRecipe('');setOpen(false);}} categories={categories} busy={busy} allowAuto={false} onCreate={onCreateCategory}/>}
  {!creating?(canChoose?<><div className="form-label">{current?'בחירת מנה באותה קטגוריה':'בחירה מהמאגר'}<Popover open={open&&!busy} onOpenChange={setOpen}><PopoverTrigger asChild><button type="button" autoFocus className="dish-picker-trigger" aria-label="בחירת מנה מהמאגר" aria-expanded={open&&!busy} disabled={busy}><span>{chosen&&<CategoryBadge category={chosen.category}/>}{chosen?.name||'חיפוש ובחירת מנה…'}</span><ChevronDown size={17}/></button></PopoverTrigger><PopoverContent className="dish-picker" align="start" dir="rtl"><Command label="בחירת מנה"><CommandInput placeholder="חיפוש מנה…" aria-label="חיפוש מנה להחלפה"/><CommandList><CommandEmpty>לא נמצאו מנות מתאימות.</CommandEmpty>{choices.map(d=><CommandItem key={d.name} value={d.name} onSelect={()=>{setSelected(d.name);setRecipe(d.recipe_url||'');setOpen(false);}}><CategoryBadge category={d.category}/><span>{d.name}{d.name===current?.name&&<small className="current-choice">בתפריט</small>}</span>{selected===d.name&&<Check size={16}/>}</CommandItem>)}</CommandList></Command></PopoverContent></Popover></div><button type="button" className="create-new" disabled={busy} onClick={()=>{setCreating(true);setRecipe('');}}><Plus size={17}/> יצירת מנה חדשה</button></>:null):<><label className="form-label">שם המנה החדשה<input autoFocus required maxLength={100} value={name} onChange={e=>setName(e.target.value)} disabled={busy} placeholder="למשל מרק אפונה"/></label><button type="button" className="back-link" disabled={busy} onClick={()=>{setCreating(false);setRecipe(chosen?.recipe_url||'');}}>בחירה מתוך המאגר</button></>}
  {(canChoose||creating)&&<RecipeField value={recipe} onChange={setRecipe} disabled={busy}/>}
  {(canChoose||creating)&&<div className="editor-details"><PreparationPicker dish={{name:dish?.name||'המנה',category:dish?.category||'extra',prepared_by:responsible}} onAssign={async value=>{setResponsible(value);return true;}}/>{transfer?.(transferDirty,responsible)}</div>}{transfer&&transferDirty&&<p className="editor-hint">יש לשמור או לבטל את השינויים לפני העברה לארוחה אחרת.</p>}
  <div className="form-actions editor-footer"><Button className="form-button primary-save" disabled={busy||!dish?.name||!dirty}>{busy&&<LoaderCircle size={16} className="spin"/>}שמירה</Button><Button className="form-button" type="button" disabled={busy} onClick={onCancel}>ביטול</Button></div>{error&&<p role="alert" className="form-error">{error}</p>}
 </form>;
}
