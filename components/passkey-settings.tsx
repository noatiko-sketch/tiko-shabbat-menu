import {useEffect,useRef,useState} from 'react';
import {googleTransport} from '../lib/google-transport';
import {createPasskey,passkeyMessage,supportsPasskeys} from '../lib/passkeys-client';
type Device={id:string;label:string;createdAt:number;lastUsedAt?:number};
export function PasskeySettings({requiresCode,onClose}:{requiresCode:boolean;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[code,setCode]=useState(''),[unlocked,setUnlocked]=useState(!requiresCode||googleTransport().hasFamilyCode()),[label,setLabel]=useState(''),[devices,setDevices]=useState<Device[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[prepared,setPrepared]=useState<{challengeId:string;options:any}|null>(null);
 const alive=useRef(true);useEffect(()=>{alive.current=true;dialog.current?.showModal();return()=>{alive.current=false;dialog.current?.close();};},[]);
 const call=(op:string,fields:Record<string,unknown>={})=>googleTransport().passkeyRequest(op,fields,code||undefined);
 const load=async()=>{const result=await call('list');if(alive.current)setDevices(result.credentials);};
 const work=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setMessage('');try{await fn();}catch(e){if(alive.current)setError(passkeyMessage(e));}finally{if(alive.current)setBusy(false);}};
 useEffect(()=>{if(unlocked)void work(load);},[]);
 return <dialog className="passkey-dialog" ref={dialog} aria-labelledby="passkey-heading" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}>
  <div dir="rtl"><header><h2 id="passkey-heading">כניסה באמצעות המכשיר</h2><button type="button" disabled={busy} onClick={onClose} aria-label="סגירה">סגירה</button></header>
  <p>אפשר להיכנס עם טביעת אצבע, זיהוי פנים או קוד נעילת המכשיר. טיקו אינה מקבלת מידע ביומטרי.</p>
  {!unlocked?<form onSubmit={e=>{e.preventDefault();void work(async()=>{await load();if(alive.current)setUnlocked(true);});}}><label>קוד משפחתי לניהול מפתחות גישה<input autoFocus type="password" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} required disabled={busy}/></label><button disabled={busy}>פתיחת ההגדרות</button></form>:<>
   {supportsPasskeys()?<form onSubmit={e=>{e.preventDefault();void work(async()=>{
    if(!prepared){const begin=await call('register_begin',{label});if(alive.current)setPrepared(begin);return;}
    const begin=prepared;setPrepared(null);const credential=await createPasskey(begin.options);
    await call('register_finish',{challengeId:begin.challengeId,credential});await load();
    if(alive.current){setLabel('');setMessage('מפתח הגישה נוסף. בכניסה הבאה אפשר לבחור ״כניסה באמצעות המכשיר״.');}
   });}}><label>שם לזיהוי המפתח<input autoFocus value={label} onChange={e=>{setLabel(e.target.value);setPrepared(null);}} placeholder="למשל: אבא — גלקסי" maxLength={60} required disabled={busy}/></label><button disabled={busy||!label.trim()}>{busy?'ממתינים…':prepared?'אישור ושמירת מפתח במכשיר':'הגדרת כניסה במכשיר'}</button>{prepared&&<p role="status">החיבור מוכן. לחצו על אישור ושמירת מפתח במכשיר.</p>}</form>:<p>הדפדפן הזה אינו תומך בהוספת מפתח גישה. הקוד המשפחתי ממשיך לעבוד.</p>}
   <h3>מפתחות הגישה של המשפחה</h3><p className="passkey-note">מפתח עשוי להסתנכרן דרך Google או Apple למכשירים נוספים. ביטולו יבטל גם כניסות פעילות שנעשו באמצעותו.</p>
   {devices.length===0?<p>עדיין לא הוגדרו מפתחות גישה.</p>:<ul>{devices.map(device=><li key={device.id}><div><strong>{device.label}</strong><small>{device.lastUsedAt?'שימוש אחרון: '+new Date(device.lastUsedAt).toLocaleDateString('he-IL'):'טרם שימש לכניסה'}</small></div><button disabled={busy} onClick={()=>{if(window.confirm(`לבטל את מפתח הגישה ״${device.label}״? הכניסה בקוד המשפחתי תישאר זמינה.`))void work(async()=>{await call('revoke',{credentialId:device.id});await load();setMessage('מפתח הגישה בוטל.');});}}>ביטול גישה</button></li>)}</ul>}
  </>}
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  <p className="passkey-note">במכשיר חדש או במקרה של אובדן גישה, אפשר להיכנס עם הקוד המשפחתי ולנהל כאן את המפתחות.</p></div>
 </dialog>;
}
