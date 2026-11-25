'use client';
import {useAppBack} from '@/components/app-back';
import type {CreateCategory} from '@/components/category-creator';
import {useState,type ReactNode} from 'react';
import {Plus,LoaderCircle,ChevronDown,Check,Trash2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {CategoryBadge,CategorySelect,PreparationPicker} from '@/components/family-tools';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {Command,CommandInput,CommandList,CommandEmpty,CommandItem} from '@/components/ui/command';
import {RecipeField} from '@/components/recipe';
import type {Dish} from '@/lib/menu-model';
export function DishEditor({current,candidates,busy,error,onSave,onCancel,transfer,onRemove,categories={},adding=false,slotCategory,onCreateCategory}:{onCreateCategory?:CreateCategory;categories?:Record<string,string>;adding?:boolean;slotCategory?:string;transfer?:(dirty:boolean,responsible:string)=>ReactNode;onRemove?:()=>void;current?:Dish|null;candidates:Dish[];busy:boolean;error:string;onSave:(dish:Dish,responsible:string)=>Promise<void>;onCancel:()=>void}){
 const [creating,setCreating]=useState(false),[selected,setSelected]=useState(current?.name||''),[name,setName]=useState(''),[open,setOpen]=useState(false),[category,setCategory]=useState(current?.category||''),[responsible,setResponsible]=useState(current?.prepared_by||''),[recipe,setRecipe]=useState(current?.recipe_url||'');
 const [targetCategory,setTargetCategory]=useState('');
 const choices=adding&&category?candidates.filter(d=>d.category===category):candidates;
 const editingCurrent=!adding&&!!current&&current.name===selected;
 const chosen=editingCurrent?current:choices.find(d=>d.name===selected);
 const dish=creating?(category||!adding?{name:name.trim(),category:category||'auto',recipe_url:recipe.trim()}:undefined):chosen?{...chosen,category:editingCurrent&&targetCategory?targetCategory:chosen.category,recipe_url:recipe.trim()}:undefined;
 const returnToPicker=()=>{setCreating(false);setRecipe(chosen?.recipe_url||'');};
 useAppBack(creating,2,returnToPicker,busy);
 const transferDirty=creating||selected!==(current?.name||'')||dish?.category!==current?.category||recipe.trim()!==(current?.recipe_url||'');
 const dirty=!!dish&&(adding||dish.name!==current?.name||dish.category!==current?.category||responsible!==(current?.prepared_by||'')||recipe.trim()!==(current?.recipe_url||''));
 const showDetails=!adding||creating||!!category||!!chosen;
 const searchAll=adding&&!category;
 const pickerLabel=slotCategory?`בחירת מנה מקטגוריית ${categories[slotCategory]||categories.extra||slotCategory}`:searchAll?'חיפוש בכל מאגר המנות':'בחירה מהמאגר';
 return <form className="inline-dish-editor focused-editor" aria-label={adding?'הוספת מנה':'עריכת מנה'} aria-busy={busy} onSubmit={e=>{e.preventDefault();if(!busy&&!open&&dish&&dirty)void onSave(dish,responsible);}}>
  <div className="editor-heading"><h3>{adding?'הוספת מנה':'עריכת מנה'}</h3>{onRemove&&<button type="button" className="icon-action editor-remove" disabled={busy} title="הסרת המנה" aria-label={`הסרת ${current?.name||'מנה'}`} onClick={onRemove}><Trash2 size={17}/></button>}</div>
  {(adding||creating)&&<CategorySelect value={category} onChange={value=>{setCategory(value);setSelected('');setRecipe('');setOpen(false);}} categories={categories} busy={busy} allowAuto={false} allowAll={adding&&!creating} onCreate={onCreateCategory}/>}
  {!creating?<>
   <div className="form-label">
    {pickerLabel}
    <Popover open={open&&!busy} onOpenChange={setOpen}>
     <PopoverTrigger asChild>
      <button type="button" autoFocus className="dish-picker-trigger" aria-label={pickerLabel} aria-expanded={open&&!busy} disabled={busy}>
       <span>{dish&&<CategoryBadge category={dish.category} decorative/>}{chosen?.name||'חיפוש ובחירת מנה…'}</span><ChevronDown size={17}/>
      </button>
     </PopoverTrigger>
     <PopoverContent className="dish-picker" align="start" dir="rtl">
      <Command label={pickerLabel}>
       <CommandInput placeholder={searchAll?'חיפוש בכל המאגר…':'חיפוש מנה…'} aria-label={searchAll?pickerLabel:adding?'חיפוש מנה להוספה':'חיפוש מנה להחלפה'}/>
       <CommandList>
        <CommandEmpty>לא נמצאו מנות מתאימות.</CommandEmpty>
        {choices.map(d=>{
         const categoryLabel=categories[d.category]||categories.extra||d.category;
         return <CommandItem key={d.name} value={d.name} onSelect={()=>{
          setSelected(d.name);
          setRecipe((d.name===current?.name?current.recipe_url:d.recipe_url)||'');
          setOpen(false);
         }}>
          <CategoryBadge category={d.category} label={categoryLabel} decorative/>
          <span>{d.name}{searchAll&&<small className="current-choice">{categoryLabel}</small>}{d.name===current?.name&&<small className="current-choice">בתפריט</small>}</span>
          {selected===d.name&&<Check size={16}/>}
         </CommandItem>;
        })}
       </CommandList>
      </Command>
     </PopoverContent>
    </Popover>
   </div>
   <button type="button" className="create-new" disabled={busy} onClick={()=>{setCreating(true);setRecipe('');}}><Plus size={17}/> יצירת מנה חדשה</button>
  </>:<><label className="form-label">שם המנה החדשה<input autoFocus required maxLength={100} value={name} onChange={e=>setName(e.target.value)} disabled={busy} placeholder="למשל מרק אפונה"/></label><button type="button" className="back-link" disabled={busy} onClick={returnToPicker}>בחירה מתוך המאגר</button></>}
  {!creating&&editingCurrent&&<CategorySelect label="העברה לקטגוריה" value={targetCategory||current.category} onChange={setTargetCategory} categories={categories} busy={busy} allowAuto={false} onCreate={onCreateCategory}/>}
  {showDetails&&<RecipeField value={recipe} onChange={setRecipe} disabled={busy}/>}
  {showDetails&&<div className="editor-details"><PreparationPicker dish={{name:dish?.name||'המנה',category:dish?.category||'extra',prepared_by:responsible}} onAssign={async value=>{setResponsible(value);return true;}}/>{transfer?.(transferDirty,responsible)}</div>}{transfer&&transferDirty&&<p className="editor-hint">יש לשמור או לבטל את השינויים לפני העברה לארוחה אחרת.</p>}
  <div className="form-actions editor-footer"><Button className="form-button primary-save" disabled={busy||!dish?.name||!dirty}>{busy&&<LoaderCircle size={16} className="spin"/>}שמירה</Button><Button className="form-button" type="button" disabled={busy} onClick={onCancel}>ביטול</Button></div>{error&&<p role="alert" className="form-error">{error}</p>}
 </form>;
}
