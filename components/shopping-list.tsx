'use client';
import {apiFetch} from '@/lib/google-transport';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {Check,ChevronDown,LoaderCircle,Pencil,Plus,Search,ShoppingCart,Trash2,X} from 'lucide-react';
import {shoppingCategories,type ShoppingAction,type ShoppingCategory,type ShoppingProduct,type ShoppingSnapshot} from '@/lib/shopping';
import {confirmShoppingAddition} from '@/lib/shopping-addition';
import {ShoppingPhotoImport} from '@/components/shopping-photo-import';
import {ShoppingMutations} from '@/lib/shopping-mutations';

export function ShoppingList({person,onSavingChange}:{person:string;onSavingChange:(saving:boolean)=>void}){
 const [snapshot,setSnapshot]=useState<ShoppingSnapshot|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const [name,setName]=useState(''),[category,setCategory]=useState<ShoppingCategory>('general'),[quantity,setQuantity]=useState(''),[adding,setAdding]=useState(false),[showAdd,setShowAdd]=useState(false);
 const [search,setSearch]=useState(''),[filter,setFilter]=useState(''),[clearConfirm,setClearConfirm]=useState(false),[moving,setMoving]=useState<string|null>(null);
 const snapshotRef=useRef(snapshot),pending=useRef(false),version=useRef(0),mounted=useRef(true),flight=useRef<AbortController|null>(null);
 snapshotRef.current=snapshot;
 const queue=useRef<ShoppingMutations|null>(null);
 if(!queue.current)queue.current=new ShoppingMutations(()=>snapshotRef.current,s=>{snapshotRef.current=s;if(mounted.current)setSnapshot(s);},active=>{pending.current=active;if(mounted.current){setSaving(active);onSavingChange(active);}},person);
 const refresh=useCallback(async(background=false)=>{
  if(!person||pending.current)return;
  flight.current?.abort();const controller=new AbortController();flight.current=controller;const started=version.current;
  const timeout=setTimeout(()=>controller.abort(),35000);if(!background)setLoading(true);
  try{
   const r=await apiFetch('/api/shopping',{cache:'no-store',headers:{'x-family-member':encodeURIComponent(person)},signal:controller.signal});
   const result=await r.json() as ShoppingSnapshot & {detail?:string};if(!mounted.current||started!==version.current||flight.current!==controller)return;
   if(!r.ok||result.status!=='ready'||!result.shopping)throw Error(result.detail||'רשימת הקניות לא נטענה.');
   snapshotRef.current=result;setSnapshot(result);
  }catch(e){if(mounted.current&&started===version.current&&flight.current===controller)setError(controller.signal.aborted?'הטעינה ארכה יותר מדי. אפשר לנסות שוב.':(e as Error).message);}
  finally{clearTimeout(timeout);if(mounted.current&&flight.current===controller)setLoading(false);}
 },[person]);
 useEffect(()=>{mounted.current=true;void refresh();return()=>{mounted.current=false;flight.current?.abort();onSavingChange(false);};},[refresh,onSavingChange]);
 useEffect(()=>{
  const update=()=>{if(document.visibilityState==='visible'&&!pending.current)void refresh(true);};
  const timer=setInterval(update,30000);document.addEventListener('visibilitychange',update);window.addEventListener('online',update);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);window.removeEventListener('online',update);};
 },[refresh]);
 useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(pending.current)event.preventDefault();};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[]);
 const act=async(fields:Omit<ShoppingAction,'mutationId'|'revision'>)=>{
  const confirmed=snapshotRef.current&&confirmShoppingAddition(snapshotRef.current.shopping,fields,message=>window.confirm(message));
  if(!confirmed)return false;
  return actApproved(confirmed);
 };
 const actApproved=async(fields:Omit<ShoppingAction,'mutationId'|'revision'>)=>{
  setError('');version.current++;flight.current?.abort();
  try{
   const action={...fields,mutationId:crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('')};
   await queue.current!.enqueue(action,async revision=>{
    const r=await apiFetch('/api/shopping',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(35000),headers:{'content-type':'application/json','x-family-member':encodeURIComponent(person)},body:JSON.stringify({...action,revision})});
    const result=await r.json() as {snapshot?:ShoppingSnapshot;detail?:string};if(!r.ok||!result.snapshot?.shopping)throw Error(result.detail||'לא התקבל אישור שמירה.');return result.snapshot;
   });return true;
  }catch(e){
   if(mounted.current){setError(`השינוי לא אושר ונשארה הרשימה האחרונה שנשמרה. ${(e as Error).message||'יש לבדוק את החיבור ולנסות שוב.'}`);void refresh(true);}return false;
  }
 };
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(adding)return;setAdding(true);const submitted=name,submittedQuantity=quantity;
  const ok=await act({type:'shopping_add',name,category,quantity});
  if(mounted.current){if(ok){setName(value=>value===submitted?'':value);setQuantity(value=>value===submittedQuantity?'':value);}setAdding(false);}
 };
 const data=snapshot?.shopping,products=data?.products||[],items=data?.items||[];
 const remaining=items.filter(i=>!i.bought),bought=items.filter(i=>i.bought),byId=new Map(products.map(p=>[p.id,p]));
 const catalog=products.filter(p=>(!filter||p.category===filter)&&p.name.includes(search.trim())).sort((a,b)=>a.name.localeCompare(b.name,'he'));
 const categoryEditor=(product:ShoppingProduct,scope='active')=>moving===`${scope}:${product.id}`&&<div className="shopping-category-editor"><label>קטגוריה של {product.name}<select aria-label={`קטגוריה של ${product.name}`} value={product.category} onChange={e=>{setMoving(null);void act({type:'shopping_recategorize',productId:product.id,category:e.target.value});}}>{Object.entries(shoppingCategories).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label><button type="button" onClick={()=>setMoving(null)}>סגירה</button></div>;
 const moveButton=(product:ShoppingProduct,scope='active')=><button className="shopping-remove" type="button" aria-label={`שינוי קטגוריה של ${product.name}`} aria-expanded={moving===`${scope}:${product.id}`} onClick={()=>setMoving(moving===`${scope}:${product.id}`?null:`${scope}:${product.id}`)}><Pencil size={16}/></button>;
 const renderItem=(product:ShoppingProduct,item:typeof items[number])=><li className={`shopping-row ${item.bought?'is-bought':''}`} key={product.id}>
  <label className="shopping-check"><input type="checkbox" checked={item.bought} onChange={e=>void act({type:'shopping_toggle',productId:product.id,bought:e.target.checked})}/><span className="shopping-checkmark" aria-hidden="true">{item.bought&&<Check size={20}/>}</span><span className="shopping-item-copy"><strong>{product.name}</strong>{item.quantity&&<small>{item.quantity}</small>}<small className="shopping-added-by">{item.added_by?`נוסף על ידי ${item.added_by}`:item.updated_by?`עדכון אחרון: ${item.updated_by}`:"מי שהוסיף לא תועד"}</small></span><span className="sr-only">{item.bought?' — נקנה, ביטול הסימון יחזיר לרשימה':' — סימון כנקנה'}</span></label>
  {moveButton(product)}<button className="shopping-remove" type="button" aria-label={`הסרת ${product.name} מהרשימה`} onClick={()=>void act({type:'shopping_remove',productId:product.id})}><X size={17}/></button>{categoryEditor(product)}
 </li>;
 return <section className="shopping" aria-label="רשימת קניות">
  <header className="shopping-compact-header"><h1>רשימת קניות{snapshot&&<span className="shopping-count" aria-label={`${remaining.length} מוצרים לקנייה`}>{remaining.length}</span>}</h1>{person&&snapshot&&<button type="button" className="shopping-add-trigger" aria-expanded={showAdd} aria-controls="shopping-add-panel" onClick={()=>setShowAdd(value=>!value)}>{showAdd?<X size={19}/>:<Plus size={19}/>} {showAdd?'סגירה':'הוספה'}</button>}</header>
  {!person?<p className="shopping-empty">יש לבחור בן משפחה למעלה כדי לפתוח את רשימת הקניות.</p>:<>
   {error&&<div className="shopping-error" role="alert"><p>{error}</p><button type="button" disabled={saving} onClick={()=>{setError('');void refresh();}}>טעינה מחדש</button></div>}
   {loading&&!snapshot?<p className="shopping-loading" role="status"><LoaderCircle className="spin" size={20}/>טוענים את הרשימה המשפחתית…</p>:!snapshot?<p className="shopping-empty">הרשימה אינה זמינה כרגע. אפשר לנסות שוב באמצעות טעינה מחדש.</p>:<>
    <ShoppingPhotoImport person={person} busy={saving} onImport={async items=>{
     if(!snapshotRef.current)return false;
     const confirmed=confirmShoppingAddition(snapshotRef.current.shopping,{type:'shopping_import',items},message=>window.confirm(message));
     if(!confirmed)return null;
     return await actApproved(confirmed)?confirmed.items!.length:false;
    }}/>
    <div className={`shopping-layout ${showAdd?'is-adding':''}`}><div className="shopping-active">
     <div className="shopping-section-heading"><h2 className="sr-only">לקנייה</h2><span role="status" className={saving?'shopping-saving':''}>{saving?<><LoaderCircle className="spin" size={14}/> שומרים…</>:error?'יש לבדוק את השמירה':<></>}</span></div>
     {remaining.length===0&&<p className="shopping-empty">{bought.length?'הכול נקנה':'הרשימה ריקה'}</p>}
     {Object.entries(shoppingCategories).map(([id,label])=>{
      const rows=remaining.filter(i=>byId.get(i.productId)?.category===id);return rows.length>0&&<section className="shopping-group" key={id} aria-label={label}><h3>{label}<span>{rows.length}</span></h3><ul>{rows.map(i=>renderItem(byId.get(i.productId)!,i))}</ul></section>;
     })}
     {bought.length>0&&<details className="shopping-bought"><summary><span><Check size={18}/> כבר נקנה <b>{bought.length}</b></span><ChevronDown size={18}/></summary><ul>{bought.map(i=>renderItem(byId.get(i.productId)!,i))}</ul>
      {clearConfirm?<div className="shopping-clear-confirm"><p>לנקות את המוצרים שנקנו?</p><button type="button" disabled={saving} onClick={()=>{setClearConfirm(false);void act({type:'shopping_clear_bought'});}}>ניקוי</button><button type="button" onClick={()=>setClearConfirm(false)}>ביטול</button></div>:<button type="button" className="shopping-clear" disabled={saving} onClick={()=>setClearConfirm(true)}><Trash2 size={15}/> ניקוי מוצרים שנקנו</button>}
     </details>}
    </div>{showAdd&&<aside id="shopping-add-panel" className="shopping-add-panel" aria-label="הוספת מוצרים">
     <h2 className="sr-only">הוספת מוצרים</h2>
     <form onSubmit={submit} className="shopping-form"><label>שם המוצר<input autoFocus autoComplete="off" value={name} onChange={e=>setName(e.target.value)} maxLength={100} required placeholder="שם המוצר"/></label>
      <div className="shopping-form-pair"><label>קטגוריה<select value={category} onChange={e=>setCategory(e.target.value as ShoppingCategory)}>{Object.entries(shoppingCategories).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label><label>כמות <small>(לא חובה)</small><input value={quantity} onChange={e=>setQuantity(e.target.value)} maxLength={60} placeholder={'כמות'}/></label></div>
      <button className="shopping-primary" type="submit" disabled={adding||!name.trim()}>{adding?<LoaderCircle className="spin" size={18}/>:<Plus size={18}/>} הוספה</button>
     </form>
     <details className="shopping-catalog"><summary>מהמאגר <span>{products.length}</span><ChevronDown size={17}/></summary>
      {products.length===0?<p className="shopping-hint">המאגר ריק</p>:<><label className="shopping-search"><Search size={17}/><input aria-label="חיפוש מוצר במאגר" value={search} onChange={e=>setSearch(e.target.value)} placeholder="איזה מוצר להוסיף?"/></label><select aria-label="סינון המאגר לפי קטגוריה" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">כל הקטגוריות</option>{Object.entries(shoppingCategories).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
       {catalog.length===0?<p className="shopping-hint">לא נמצאו מוצרים</p>:Object.entries(shoppingCategories).map(([id,label])=>{const group=catalog.filter(p=>p.category===id);return group.length>0&&<div className="shopping-catalog-group" key={id}><h3>{label}</h3>{group.map(product=>{const active=items.find(i=>i.productId===product.id);return <div className="shopping-catalog-entry" key={product.id}><div><button type="button" onClick={()=>void act({type:'shopping_add',productId:product.id})} aria-label={`הוספת ${product.name} לרשימה`}><span>{product.name}</span>{active&&!active.bought?<small><Check size={14}/> ברשימה</small>:<Plus size={17}/>}</button>{moveButton(product,'catalog')}</div>{categoryEditor(product,'catalog')}</div>;})}</div>;})}</>}
     </details>
    </aside>}</div>
   </>}
  </>}
 </section>;
}
