import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import {InstallApp,InstallInstructions} from '../components/family-tools';
import {googleTransport,retryGoogleConnection,directGoogleUrl} from '../lib/google-transport';
import {PasskeySettings} from '../components/passkey-settings';
import {Button} from '../components/ui/button';
import {Dialog,DialogContent,DialogFooter,DialogTitle} from '../components/ui/dialog';
import {protectAppBack} from '../lib/app-exit-history';
import '../app/globals.css';
import './pages.css';

function Connection({children}:{children:React.ReactNode}){
 const [,setNoticeVersion]=useState(0);
 const [exit,setExit]=useState<'back'|'logout'|null>(null),[exitHint,setExitHint]=useState(false);
 const backProtection=useRef<ReturnType<typeof protectAppBack>|null>(null);
 const stayButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const protection=protectAppBack(window,()=>setExit('back'),()=>setExitHint(false));
  backProtection.current=protection;
  return ()=>{protection.dispose();backProtection.current=null;};
 },[]);
 useEffect(()=>{const update=()=>setNoticeVersion(value=>value+1);window.addEventListener('tiko-auth-notice',update);return()=>window.removeEventListener('tiko-auth-notice',update);},[]);
 const [state,setState]=useState<'loading'|'code'|'ready'>('loading'),[code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[settings,setSettings]=useState(false),[config,setConfig]=useState({requiresCode:true,passkeys:false}),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let active=true;const client=googleTransport();setState('loading');setError('');
  void client.ready().then(async config=>{
   if(!active)return;setConfig(config);
   const restored=await client.restoreRemembered();if(!active)return;
   if(restored)setState('ready');else if(config.requiresCode)setState('code');else{await client.connect('');if(active)setState('ready');}
  }).catch(e=>{if(active){setError(e.name==='TimeoutError'?'החיבור ארך יותר מדי זמן. אפשר לנסות שוב.':e.message);setState('code');}});
  return()=>{active=false;};
 },[attempt]);
 useEffect(()=>{const expired=()=>{setSettings(false);setCode('');setError('הכניסה פגה או שבוטלה. יש להיכנס שוב.');setState('code');};window.addEventListener('tiko-auth-expired',expired);return()=>window.removeEventListener('tiko-auth-expired',expired);},[]);
 const confirmExit=async()=>{
  setExit(null);
  if(exit==='back'){
   if(backProtection.current?.leave()===false)setExitHint(true);
  }else if(exit==='logout'){
   setBusy(true);
   try{await googleTransport().disconnect();}catch{}finally{setBusy(false);setCode('');setError('');setState('code');}
  }
 };
 return <>
  <Dialog open={exit!==null} onOpenChange={open=>{if(!open)setExit(null);}}>
   <DialogContent dir="rtl" showCloseButton={false} aria-describedby={undefined} onOpenAutoFocus={event=>{event.preventDefault();stayButton.current?.focus();}}>
    <DialogTitle>לצאת מהאפליקציה?</DialogTitle>
    <DialogFooter className="flex-row justify-end">
     <Button type="button" className="min-h-11" variant="outline" ref={stayButton} onClick={()=>setExit(null)}>להישאר</Button>
     <Button type="button" className="min-h-11" onClick={()=>void confirmExit()}>יציאה</Button>
    </DialogFooter>
   </DialogContent>
  </Dialog>
  {exitHint&&<p className="connection-notice" role="status" dir="rtl">לחצו שוב על חזור במכשיר כדי לצאת מטיקו.</p>}
  {state==='ready'?<><div className="connection-security" dir="rtl">{config.passkeys&&<button onClick={()=>setSettings(true)}>הגדרות כניסה</button>}<button disabled={busy} onClick={()=>setExit('logout')}>יציאה</button></div>{googleTransport().notice&&<p className="connection-notice" role="status" dir="rtl">{googleTransport().notice}</p>}{settings&&<PasskeySettings requiresCode={config.requiresCode} onClose={()=>setSettings(false)}/>} {children}</>
  :<main className="connection-page" dir="rtl"><h1>אוכל לשבת</h1>
  {state==='loading'&&<p role="status">מתחברים למאגר המשפחתי…</p>}
  {state==='code'&&<form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await googleTransport().connect(code);setCode('');setState('ready');}catch(e){setError((e as Error).name==='TimeoutError'?'החיבור ארך יותר מדי זמן. אפשר לנסות שוב.':(e as Error).message);}finally{setBusy(false);}}}><label>קוד הכניסה המשפחתי<input name="password" type="password" autoComplete="current-password" value={code} onChange={e=>setCode(e.target.value)} disabled={busy} required/></label><button disabled={busy}>{busy?'מתחברים…':'כניסה'}</button></form>}
  {error&&<p role="alert">{error}</p>}
  {state==='code'&&!document.querySelector('meta[name="tiko-native"]')&&<a className="direct-google-link" href={directGoogleUrl()}>פתיחה בחיבור ישיר</a>}
  {(error||state==='loading')&&<button type="button" disabled={busy} onClick={()=>{retryGoogleConnection();setAttempt(value=>value+1);}}>ניסיון חיבור מחדש</button>}
 </main>}
 </>;
}
const base=document.querySelector('meta[name="tiko-base"]')?.getAttribute('content')||'/';
const path=location.pathname.slice(base.length).replace(/\/+$/,'');
const screen=path==='install/help'?<InstallInstructions/>:path==='install'?<InstallApp/>:<Connection><Home/></Connection>;
createRoot(document.getElementById('root')!).render(screen);
