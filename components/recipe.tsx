'use client';
import {BookOpen,Link2} from 'lucide-react';
import {recipeUrl} from '@/lib/recipe-url';
export function RecipeField({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}){
 return <label className="form-label recipe-field"><span><Link2 size={15}/> קישור למתכון <small>(לא חובה)</small></span><input type="url" inputMode="url" dir="ltr" maxLength={2048} placeholder="https://…" value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}/></label>;
}
export function RecipeLink({url,name}:{url?:string;name:string}){
 let href='';try{href=recipeUrl(url);}catch{return null;}
 return href?<a className="recipe-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={`פתיחת המתכון של ${name} בלשונית חדשה`} title="פתיחת המתכון"><BookOpen size={16}/></a>:null;
}
