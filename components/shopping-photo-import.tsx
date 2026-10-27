'use client';
import {useEffect,useRef,useState,type ChangeEvent} from 'react';
import {Camera,Check,ImagePlus,LoaderCircle,Plus,Trash2,X} from 'lucide-react';
import {shoppingCategories,type ShoppingCategory,type ShoppingImportItem} from '@/lib/shopping';
import {confirmedShoppingItems,parseShoppingScan,reviewShoppingScan,type ReviewShoppingItem} from '@/lib/shopping-scan';
import {prepareShoppingPhoto} from '@/lib/shopping-photo';

export function ShoppingPhotoImport({person,busy,onImport}:{person:string;busy:boolean;onImport:(items:ShoppingImportItem[])=>Promise<boolean>}){
 const [image,setImage]=useState(''),[rows,setRows]=useState<ReviewShoppingItem[]|null>(null),[warning,setWarning]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [preparing,setPreparing]=useState(false),[scanning,setScanning]=useState(false),[importing,setImporting]=useState(false);
 const camera=useRef<HTMLInputElement>(null),gallery=useRef<HTMLInputElement>(null),version=useRef(0),mounted=useRef(true),flight=useRef<AbortController|null>(null),manualId=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;version.current++;flight.current?.abort();};},[]);
 const cancel=()=>{version.current++;flight.current?.abort();setImage('');setRows(null);setWarning('');setError('');setPreparing(false);setScanning(false);};
 const choose=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  const attempt=++version.current;flight.current?.abort();setPreparing(true);setScanning(false);setError('');setSuccess('');setRows(null);setImage('');setWarning('');
  try{const prepared=await prepareShoppingPhoto(file);if(mounted.current&&attempt===version.current)setImage(prepared);}
  catch(e){if(mounted.current&&attempt===version.current)setError((e as Error).message);}
  finally{if(mounted.current&&attempt===version.current)setPreparing(false);}
 };
 const analyze=async()=>{
  if(!image||scanning)return;const attempt=++version.current,controller=new AbortController();flight.current=controller;setScanning(true);setError('');setRows(null);
  const timer=setTimeout(()=>controller.abort(),85000);
  try{
   const response=await fetch('/api/shopping/scan',{method:'POST',cache:'no-store',headers:{'content-type':'application/json','x-family-member':encodeURIComponent(person)},body:JSON.stringify({image}),signal:controller.signal});
   const result=await response.json() as {detail?:string};
   if(!mounted.current||attempt!==version.current)return;
   if(!response.ok)throw Error(result.detail||'הפענוח נכשל. אפשר לנסות שוב או להוסיף ידנית.');
   const scan=parseShoppingScan(result);setRows(reviewShoppingScan(scan));setWarning(scan.warning);
  }catch(e){if(mounted.current&&attempt===version.current)setError(controller.signal.aborted?'הפענוח ארך יותר מדי. אפשר לנסות שוב.':(e as Error).message);}
  finally{clearTimeout(timer);if(mounted.current&&attempt===version.current)setScanning(false);}
 };
 const edit=(id:string,patch:Partial<ReviewShoppingItem>)=>setRows(previous=>previous?.map(row=>row.id===id?{...row,...patch}:row)||null);
 const confirm=async()=>{
  if(importing||busy)return;
  try{
   const items=confirmedShoppingItems(rows||[]);setError('');setImporting(true);
   const ok=await onImport(items);
   if(!mounted.current)return;
   if(ok){cancel();setSuccess(`המוצרים שאישרת נוספו לרשימה (${items.length}).`);}
   else setError('ההוספה לא אושרה. התיקונים נשארו כאן; יש לבדוק את הודעת השמירה ולנסות שוב.');
  }catch(e){if(mounted.current)setError((e as Error).message);}
  finally{if(mounted.current)setImporting(false);}
 };
 const selected=rows?.filter(row=>row.selected).length||0;
 return <section className="shopping-photo" aria-label="צילום רשימת קניות">
  <div className="shopping-photo-toolbar"><div><h2>מהרשימה שעל המקרר לסל</h2><p>מצלמים, בודקים ומוסיפים רק את מה שצריך.</p></div><div className="shopping-photo-actions">
   <button type="button" disabled={busy||importing||preparing} className="shopping-photo-camera" onClick={()=>camera.current?.click()}><Camera size={18}/> צלם רשימה</button>
   <button type="button" disabled={busy||importing||preparing} onClick={()=>gallery.current?.click()}><ImagePlus size={18}/> בחירת תמונה</button>
   <input hidden type="file" accept="image/*" capture="environment" ref={camera} onChange={e=>void choose(e)} aria-label="צילום רשימה במצלמה"/>
   <input hidden type="file" accept="image/*" ref={gallery} onChange={e=>void choose(e)} aria-label="בחירת צילום רשימה"/>
  </div></div>
  {success&&<p className="shopping-photo-success" role="status"><Check size={17}/>{success}</p>}
  {error&&<p className="shopping-photo-error" role="alert">{error}</p>}
  {preparing&&<p className="shopping-photo-status" role="status"><LoaderCircle className="spin" size={18}/>מכינים את התמונה…</p>}
  {image&&<div className="shopping-photo-layout"><div className="shopping-photo-review">
   <div className="shopping-photo-review-title"><h3>{rows?'בדיקת המוצרים שפוענחו':'התמונה מוכנה לפענוח'}</h3><button type="button" disabled={importing} aria-label="סגירת צילום הרשימה" onClick={cancel}><X size={18}/></button></div>
   {rows===null?<><p className="shopping-hint">צלמו מקרוב, באור טוב, כך שהכתב יהיה ברור. התמונה תישלח ל־OpenAI לצורך הפענוח; היא אינה נשמרת בקובץ המשפחתי. המוצרים יתווספו רק לאחר בדיקה ואישור שלכם.</p><button type="button" className="shopping-primary" disabled={scanning||busy} onClick={()=>void analyze()}>{scanning?<LoaderCircle className="spin" size={18}/>:<Camera size={18}/>} {scanning?'מפענחים את הרשימה…':'פענח את התמונה'}</button>{scanning&&<p role="status" className="shopping-hint">זה עשוי לקחת כמה רגעים. עדיין לא נוספו מוצרים.</p>}</>:<>
    <p className="shopping-hint">בדקו את כל השורות, גם אלה שלא סומנו כלא ברורות. ✓ או קו על מוצר מסמנים שכבר נקנה ולכן הוא לא נבחר. אפשר לתקן ולבחור כל שורה מחדש.</p>
    {warning&&<p className="shopping-photo-warning" role="status">{warning}</p>}
    {rows.length===0&&<p className="shopping-hint">לא זוהו מוצרים. אפשר להוסיף שורות ידנית או לבחור צילום אחר.</p>}
    <ul className="shopping-scan-rows">{rows.map((row,index)=><li key={row.id} className={row.selected?'scan-selected':''}>
     <div className="shopping-scan-row-top"><label className="shopping-scan-select"><input type="checkbox" checked={row.selected} disabled={importing} onChange={e=>edit(row.id,{selected:e.target.checked})}/> הוספה לרשימה</label><div>{row.mark!=='none'&&<span className="shopping-scan-mark">{row.mark==='checked'?'✓ כבר נקנה':'מחוק בצילום'}</span>}{row.uncertain&&<span className="shopping-scan-uncertain">דורש בדיקה</span>}</div><button type="button" className="shopping-remove" disabled={importing} aria-label={`מחיקת שורה ${index+1} מהפענוח`} onClick={()=>setRows(previous=>previous!.filter(item=>item.id!==row.id))}><Trash2 size={16}/></button></div>
     <label className="shopping-scan-name">שם המוצר<input aria-label={`שם המוצר בשורה ${index+1}`} value={row.name} placeholder="יש להשלים את שם המוצר" maxLength={100} disabled={importing} onChange={e=>edit(row.id,{name:e.target.value})}/></label>
     <div className="shopping-form-pair"><label>כמות<input aria-label={`כמות בשורה ${index+1}`} value={row.quantity} maxLength={60} disabled={importing} onChange={e=>edit(row.id,{quantity:e.target.value})}/></label><label>קטגוריה<select aria-label={`קטגוריה בשורה ${index+1}`} value={row.category} disabled={importing} onChange={e=>edit(row.id,{category:e.target.value as ShoppingCategory})}>{Object.entries(shoppingCategories).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div>
     {row.note&&<p className="shopping-scan-note">{row.note}</p>}
    </li>)}</ul>
    <button type="button" className="shopping-scan-add" disabled={importing||rows.length>=80} onClick={()=>setRows(previous=>[...previous!,{id:'manual-row-'+(++manualId.current),name:'',quantity:'',category:'general',mark:'none',uncertain:false,note:'',selected:true}])}><Plus size={17}/> הוספת שורה שלא זוהתה</button>
    <button type="button" className="shopping-primary" disabled={importing||busy||selected===0} onClick={()=>void confirm()}>{importing?<LoaderCircle className="spin" size={18}/>:<Check size={18}/>} {importing?'מוסיפים לרשימה…':`הוסף מוצרים מאושרים (${selected})`}</button>
   </>}
  </div><aside className="shopping-photo-image"><img src={image} alt="צילום הרשימה להשוואה עם הפענוח"/><span>התמונה המקורית לבדיקה</span></aside></div>}
 </section>;
}
