'use client';
import {appPath} from '@/lib/app-path';
import {apiFetch} from '@/lib/google-transport';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {ChevronLeft,ChevronRight,Pencil,Trash2,Plus,LoaderCircle,ChefHat} from 'lucide-react';
import {Identity,AppBootstrap,PeopleSummary,LikeMenu,CatalogManager,CategoryBadge,DishTransfer,type FamilyStatus} from '@/components/family-tools';
import {ReorderList,ReorderRow,DragHandle} from '@/components/meal-reorder';
import {projectAction} from '@/lib/optimistic-menu';
import {MenuMutations} from '@/lib/menu-mutations';
import {isNewAssignment,assignmentToast,type AssignmentToast} from '@/lib/assignment-toast';
import {dishCandidates} from '@/lib/dish-candidates';
import {RecipeLink} from '@/components/recipe';
import {DishEditor} from '@/components/dish-editor';
import {ShoppingList} from '@/components/shopping-list';
import {family,genderText} from '@/lib/family';
import type {CatalogDish} from '@/lib/menu-store';
import {addDays,upcomingSaturday,type Dish,type Menu,type Action} from '@/lib/menu-model';
type Snapshot={catalog?:CatalogDish[];categories?:Record<string,string>;family_status?:FamilyStatus[];current:Menu|null;candidates:Record<string,Dish[]>;status:'ready'|'error';detail?:string;revision?:number;catalog_revision?:number;upcoming_saturday?:string;has_menu?:boolean};
const date=(s:string)=>`${s.slice(8,10)}.${s.slice(5,7)}.${s.slice(2,4)}`;
function LoadingMenu(){return <div className="menu-skeleton" role="status" aria-label="טעינת התפריט">{Array.from({length:6},(_,i)=><div className="skeleton-row" key={i}><span/><div><i/><i/></div></div>)}</div>;}
export default function Home(){
 const [person,setPerson]=useState(''),[tab,setTab]=useState<'menu'|'catalog'|'shopping'>('menu'),[data,setData]=useState<Snapshot|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
 const [selectedSaturday,setSelectedSaturday]=useState(()=>upcomingSaturday()),[editing,setEditing]=useState<{meal:'friday'|'lunch';index:number;adding?:boolean}|null>(null),[formError,setFormError]=useState(''),[remove,setRemove]=useState<{meal:'friday'|'lunch';index:number}|null>(null);
 useEffect(()=>{for(const src of ['/toasts/parents-minimal.webp','/toasts/bowl-minimal.webp']){const image=new Image();image.src=appPath(src);}},[]);
 const [shoppingSaving,setShoppingSaving]=useState(false);
 const [celebration,setCelebration]=useState<(AssignmentToast&{id:string})|null>(null);
 useEffect(()=>{if(!celebration)return;const timer=setTimeout(()=>setCelebration(null),1000);return()=>clearTimeout(timer);},[celebration]);
 const dragging=useRef(false),tabRef=useRef(tab);tabRef.current=tab;
 const refreshFlight=useRef<{key:string;controller:AbortController;promise:Promise<void>}|null>(null);
 const pending=useRef(false),mutationVersion=useRef(0),dataRef=useRef(data);dataRef.current=data;
 const mutations=useRef<MenuMutations<Snapshot>|null>(null);if(!mutations.current)mutations.current=new MenuMutations(()=>dataRef.current,snapshot=>{dataRef.current=snapshot;setData(snapshot);},(active,blocking)=>{pending.current=active;setSaving(active);setBusy(blocking);});const t=(text:string)=>genderText(text,person);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('tiko-member')||'null');if(saved&&family.includes(saved.name)&&Date.now()-saved.at<90*86400000)setPerson(saved.name);}catch{}},[]);
 useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),1000);return()=>clearTimeout(timer);},[message]);
 const choosePerson=(name:string)=>{setPerson(name);setEditing(null);setRemove(null);setMessage('');try{localStorage.setItem('tiko-member',JSON.stringify({name,at:Date.now()}));}catch{}};
 const acceptSnapshot=(p:Snapshot)=>setData(prev=>prev?.current?.saturday===p.current?.saturday&&(prev?.revision||0)>(p.revision||0)?prev:p);
 const refresh=useCallback(async(signal?:AbortSignal,background=false)=>{
  if(tabRef.current==='shopping'){setLoading(false);return;}
  if(!person||pending.current){if(!person)setLoading(false);return;}
  const startedVersion=mutationVersion.current,key=`${person}:${selectedSaturday}:${tabRef.current}:${startedVersion}`;
  if(refreshFlight.current?.key===key&&!refreshFlight.current.controller.signal.aborted)return refreshFlight.current.promise;
  refreshFlight.current?.controller.abort();
  const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();if(!background)setLoading(true);
  const promise=(async()=>{try{
   const r=await apiFetch(`/api/menu?saturday=${selectedSaturday}&viewed=${tabRef.current==='menu'?'1':'0'}`,{cache:'no-store',signal:controller.signal,headers:{'x-family-member':encodeURIComponent(person)}});
   const p=await r.json() as Snapshot;if(controller.signal.aborted||startedVersion!==mutationVersion.current)return;
   if(r.ok){acceptSnapshot(p);}else{if(!background)setData(p);setMessage(p.detail||'התפריט לא נטען.');}
  }catch{if(!controller.signal.aborted)setMessage('לא ניתן להתחבר כרגע. יש לנסות שוב.');}
  finally{signal?.removeEventListener('abort',abort);if(refreshFlight.current?.controller===controller){refreshFlight.current=null;setLoading(false);}}})();
  refreshFlight.current={key,controller,promise};return promise;
 },[selectedSaturday,person,tab]);
 useEffect(()=>{const c=new AbortController();void refresh(c.signal);return()=>c.abort();},[refresh]);
 useEffect(()=>{if(!person)return;const timer=setInterval(()=>{if(document.visibilityState==='visible'&&!pending.current&&!editing&&!dragging.current)void refresh(undefined,true);},30000);return()=>clearInterval(timer);},[person,editing,refresh]);
 useEffect(()=>{if(tab==='menu'&&person&&data?.current?.saturday===data?.upcoming_saturday&&!data?.family_status?.some(x=>x.name===person&&x.seen_revision===data.revision))void refresh(undefined,true);},[tab]);
 useEffect(()=>{document.querySelector('.planning-hero')?.scrollIntoView({block:'start',behavior:'instant'});},[tab]);
 const act=async(action:Action)=>{
  const requestAction={...action,actor:person,viewed:tabRef.current==='menu',mutationId:crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('')};
  setMessage('');setFormError('');
  try{
   if(!dataRef.current)return false;
   projectAction(dataRef.current,requestAction);
   const celebrate=isNewAssignment(dataRef.current.current,requestAction);
   let savedCelebration:AssignmentToast|null=null;
   mutationVersion.current++;refreshFlight.current?.controller.abort();
   const completion=mutations.current!.enqueue(requestAction,async(revision,catalogRevision)=>{
    const r=await apiFetch('/api/menu',{method:'POST',cache:'no-store',headers:{'content-type':'application/json','x-family-member':encodeURIComponent(person)},body:JSON.stringify({...requestAction,revision,catalogRevision})});
    const result=await r.json() as {detail?:string;snapshot?:Snapshot};
    if(!r.ok||!result.snapshot)throw Error(t(result.detail||'השמירה נכשלה.'));
    if(celebrate)savedCelebration=assignmentToast(result.snapshot.current,requestAction);
    return result.snapshot;
   });
   void completion.then(ok=>{if(ok&&savedCelebration)setCelebration({...savedCelebration,id:requestAction.mutationId});else if(!pending.current)setMessage('השינוי נשמר.');}).catch(error=>{
    const detail=error instanceof TypeError?'לא התקבל אישור שמירה. יש לנסות שוב.':(error as Error).message;
    setCelebration(null);setMessage(detail);setFormError(detail);void refresh(undefined,true);
   });
   return true;
  }catch(error){setFormError((error as Error).message);return false;}
 };

 const current=data?.current,connected=data?.status==='ready',isUpcoming=selectedSaturday===(data?.upcoming_saturday||upcomingSaturday()),categoryLabels=data?.categories||{};
 const openEditor=(meal:'friday'|'lunch',index:number,adding=false)=>{setEditing({meal,index,adding});setFormError('');setRemove(null);};
 const editor=(kind:'friday'|'lunch',index:number,adding=false)=> <DishEditor adding={adding} categories={categoryLabels} key={`${kind}:${index}:${adding}`} current={current?.[kind].dishes[index]} candidates={dishCandidates(data?.catalog||[],kind,current?.week||1,adding?undefined:(current?.[kind].dishes[index]?.category||current?.[kind].slot_categories?.[index]||'extra'))} onRemove={!adding&&current?.[kind].dishes[index]?()=>{setRemove({meal:kind,index});setEditing(null);}:undefined} transfer={!adding&&current?(dirty:boolean)=><DishTransfer disabled={dirty} saturday={current.saturday} meal={kind} onTransfer={async(targetSaturday,targetMeal)=>{const ok=await act({type:'transfer',saturday:current.saturday,meal:kind,index,targetSaturday,targetMeal});if(ok)setEditing(null);return ok;}}/>:undefined} busy={busy} error={formError} onCancel={()=>setEditing(null)} onSave={async(dish,responsible)=>{if(!current)return;const unchanged=!adding&&current[kind].dishes[index]?.name===dish.name&&current[kind].dishes[index]?.category===dish.category&&(current[kind].dishes[index]?.recipe_url||'')===(dish.recipe_url||'');if(await act({type:unchanged?'assign':adding?'add':'replace',saturday:current.saturday,meal:kind,index,dish,responsible}))setEditing(null);}}/>;
 const navigate=(amount:number)=>{if(pending.current)return;setEditing(null);setRemove(null);setData(null);setLoading(true);setSelectedSaturday(s=>addDays(s,amount*7));};
 const meal=(menu:Menu,kind:'friday'|'lunch')=><section className="meal" aria-label={kind==='friday'?'שישי בערב':'שבת בצהריים'}><div className="meal-heading"><h2>{kind==='friday'?'שישי בערב':'שבת בצהריים'}</h2></div><ReorderList busy={busy||!!editing||!!remove} onDraggingChange={value=>{dragging.current=value;if(value)mutationVersion.current++;}} count={menu[kind].dishes.length} onMove={(index,toIndex)=>act({type:'move',saturday:menu.saturday,meal:kind,index,toIndex})}>{menu[kind].dishes.map((dish,index)=>{const isEditing=editing?.meal===kind&&editing.index===index&&!editing.adding;return <ReorderRow index={index} className={`dish-row ${isEditing?'editing':''}`} key={`${kind}:${index}`}><div className="menu-row"><div className="dish-leading"><CategoryBadge category={dish?.category||menu[kind].slot_categories?.[index]||'extra'} label={categoryLabels[dish?.category||menu[kind].slot_categories?.[index]||'extra']}/><div className="dish-copy"><div className="dish-title-line"><span className={dish?'dish-name':'dish-empty'}>{dish?.name||'בחירת מנה'}</span>{dish&&<RecipeLink url={dish.recipe_url} name={dish.name}/>} {dish?.prepared_by&&<small className="preparation-credit" title={`האחראי להכנה: ${dish.prepared_by}`}><ChefHat size={13}/>{dish.prepared_by}</small>}</div>{dish?.updated_by&&dish.updated_by!=='אוטומטית'&&<small className="changed-by"><Pencil size={11}/>{dish.updated_by}</small>}</div></div><div className="row-actions"><DragHandle index={index} name={dish?.name||'מנה'}/><button className="icon-action" disabled={busy} title="עריכה" aria-label={`עריכת ${dish?.name||'מנה'}`} onClick={()=>openEditor(kind,index)}><Pencil size={18}/></button></div></div>{isEditing&&editor(kind,index)}{remove?.meal===kind&&remove.index===index&&<div className="inline-confirm" role="alert"><p>{t(`מה תרצי לעשות עם ״${dish?.name}״?`)}</p><div className="form-actions"><Button className="form-button" disabled={busy} onClick={async()=>{if(await act({type:'remove',saturday:menu.saturday,meal:kind,index}))setRemove(null);}}>הסרה מהתפריט</Button><Button className="form-button" disabled={busy} onClick={async()=>{if(await act({type:'remove',saturday:menu.saturday,meal:kind,index,removeFromCatalog:true}))setRemove(null);}}>הסרה גם מהמאגר</Button><Button className="form-button" disabled={busy} onClick={()=>setRemove(null)}>ביטול</Button></div></div>}</ReorderRow>;})}</ReorderList><button className="meal-add" disabled={busy} onClick={()=>openEditor(kind,menu[kind].dishes.length,true)}><Plus size={17}/> הוספת מנה</button>{editing?.meal===kind&&editing.adding&&editor(kind,menu[kind].dishes.length,true)}</section>;
 const liked=!!data?.family_status?.some(s=>s.name===person&&s.approved_revision===data.revision);
 return <main className="site" dir="rtl"><AppBootstrap/><header className="site-header"><div className="header-inner"><div className="wordmark"><img className="brand-logo" src={appPath("/icons/icon-transparent-192.png")} alt="טיקו" width={54} height={54}/></div><div className="header-controls">{(loading&&person||saving||shoppingSaving)&&<span className="loading-indicator" role="status"><LoaderCircle className="spin" size={17}/>{saving||shoppingSaving?'שמירה…':'טעינה…'}</span>}<Identity name={person} onChoose={choosePerson} busy={busy||saving||shoppingSaving}/></div></div>{(saving||shoppingSaving)&&<div className="saving-progress"/>}</header><div className="content"><nav className="section-tabs" aria-label="תפריט, מאגר וקניות"><button disabled={busy||shoppingSaving} className={tab==='menu'?'active':''} onClick={()=>setTab('menu')}>התפריט לשבת</button><button disabled={busy||shoppingSaving} className={tab==='catalog'?'active':''} onClick={()=>setTab('catalog')}>מאגר המנות</button><button disabled={busy||saving||shoppingSaving} className={tab==='shopping'?'active':''} onClick={()=>setTab('shopping')}>רשימת קניות</button></nav>{tab==='shopping'?<ShoppingList key={person} person={person} onSavingChange={setShoppingSaving}/>:<><div className={`planning-hero ${tab==='menu'?'menu-hero':''}`}><div className="intro-copy"><h1>{tab==='catalog'?'מאגר המנות':isUpcoming?'התפריט לשבת הקרובה':'התפריט לשבת'}</h1>{tab==='menu'&&current&&<p className="hero-meta"><span dir="ltr">{date(current.friday.date)} — {date(current.saturday)}</span><span aria-hidden="true">|</span><span className="menu-kind">{current.week===3?'בשרי':'צמחוני/ דגים'}</span></p>}{tab==='catalog'&&<p className="muted">כל המתכונים המשפחתיים, לפי קטגוריות.</p>}{tab==='menu'&&<nav className="week-navigation" aria-label="מעבר בין שבתות"><button className="nav-arrow" disabled={busy||saving||loading} aria-label="שבת אחת אחורה" onClick={()=>navigate(-1)}><ChevronRight size={21}/></button><button className="nav-arrow" disabled={busy||saving||loading} aria-label="שבת אחת קדימה" onClick={()=>navigate(1)}><ChevronLeft size={21}/></button>{!isUpcoming&&<button disabled={busy||saving} onClick={()=>{setData(null);setEditing(null);setSelectedSaturday(upcomingSaturday());}}>חזרה לשבת הקרובה</button>}</nav>}</div>{tab==='catalog'&&<img className="food-art" src={appPath("/shabbat-illustration.png")} alt="איור ירקות ופירות"/>}</div>{formError&&<p className="form-error" role="alert">{formError}</p>}{!person?<LoadingMenu/>:loading&&!data?<LoadingMenu/>:!connected?<div className="unavailable"><p>התפריט אינו זמין כרגע.</p><Button className="form-button" onClick={()=>void refresh()}>ניסיון נוסף</Button></div>:tab==='catalog'?<CatalogManager dishes={data?.catalog||[]} categories={categoryLabels} busy={busy} act={act} saturday={selectedSaturday}/>:current?<>{isUpcoming&&<PeopleSummary status={data?.family_status||[]} revision={data?.revision||0}/>}<p id="drag-instructions" className="sr-only">גררו את המנה באמצעות הידית בכל שורה. במקלדת אפשר להשתמש במקשי למעלה ולמטה כשהידית ממוקדת.</p><div className="menus" aria-busy={busy}>{meal(current,'friday')}{meal(current,'lunch')}</div><LikeMenu liked={isUpcoming?liked:!!current.approved} busy={busy} disabled={![...current.friday.dishes,...current.lunch.dishes].some(Boolean)||[...current.friday.dishes,...current.lunch.dishes].some(d=>!d)} onLike={()=>void act({type:isUpcoming?(liked?'family_unapprove':'family_approve'):'approve',saturday:current.saturday})}/></>:null}</>}</div>{celebration?<div key={celebration.id} className="toast assignment-toast" role="status"><img src={appPath(celebration.image)} alt="" width={240} height={160}/><strong>{celebration.text}</strong></div>:message&&<div className="toast" role="status">{t(message)}</div>}</main>;
}
