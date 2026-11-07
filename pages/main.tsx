import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import {InstallApp,InstallInstructions} from '../components/family-tools';
import {googleTransport,retryGoogleConnection} from '../lib/google-transport';
import {PasskeySettings} from '../components/passkey-settings';
import '../app/globals.css';
import './pages.css';

function Connection({children}:{children:React.ReactNode}){
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
 if(state==='ready')return <><div className="connection-security" dir="rtl">{config.passkeys&&<button onClick={()=>setSettings(true)}>הגדרות כניסה</button>}<button disabled={busy} onClick={async()=>{setBusy(true);try{await googleTransport().disconnect();}catch{}finally{setBusy(false);setCode('');setError('');setState('code');}}}>יציאה</button></div>{googleTransport().notice&&<p className="connection-notice" role="status" dir="rtl">{googleTransport().notice}</p>}{settings&&<PasskeySettings requiresCode={config.requiresCode} onClose={()=>setSettings(false)}/>} {children}</>;
 return <main className="connection-page" dir="rtl"><h1>אוכל לשבת</h1>
  {state==='loading'&&<p role="status">מתחברים למאגר המשפחתי…</p>}
  {state==='code'&&<form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await googleTransport().connect(code);setCode('');setState('ready');}catch(e){setError((e as Error).name==='TimeoutError'?'החיבור ארך יותר מדי זמן. אפשר לנסות שוב.':(e as Error).message);}finally{setBusy(false);}}}><label>קוד הכניסה המשפחתי<input name="password" type="password" autoComplete="current-password" value={code} onChange={e=>setCode(e.target.value)} disabled={busy} required/></label><button disabled={busy}>{busy?'מתחברים…':'כניסה'}</button></form>}
  {error&&<p role="alert">{error}</p>}
  {(error||state==='loading')&&<button type="button" disabled={busy} onClick={()=>{retryGoogleConnection();setAttempt(value=>value+1);}}>ניסיון חיבור מחדש</button>}
 </main>;
}
const base=document.querySelector('meta[name="tiko-base"]')?.getAttribute('content')||'/';
const path=location.pathname.slice(base.length).replace(/\/+$/,'');
const screen=path==='install/help'?<InstallInstructions/>:path==='install'?<InstallApp/>:<Connection><Home/></Connection>;
createRoot(document.getElementById('root')!).render(screen);
