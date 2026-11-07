import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import {InstallApp,InstallInstructions} from '../components/family-tools';
import {googleTransport} from '../lib/google-transport';
import {passkeyMessage,supportsPasskeys} from '../lib/passkeys-client';
import {PasskeySettings} from '../components/passkey-settings';
import '../app/globals.css';
import './pages.css';

function Connection({children}:{children:React.ReactNode}){
 const [state,setState]=useState<'loading'|'code'|'ready'>('loading'),[code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[settings,setSettings]=useState(false),[config,setConfig]=useState({requiresCode:true,passkeys:false}),[prepared,setPrepared]=useState<{challengeId:string;options:any}|null>(null);
 useEffect(()=>{let active=true;void googleTransport().ready().then(async config=>{if(!active)return;setConfig(config);if(config.requiresCode)setState('code');else{await googleTransport().connect('');if(active)setState('ready');}}).catch(e=>{if(active){setError(e.message);setState('code');}});return()=>{active=false;};},[]);
 useEffect(()=>{const expired=()=>{setSettings(false);setCode('');setError('הכניסה פגה או שמפתח הגישה בוטל. יש להיכנס שוב.');setState('code');};window.addEventListener('tiko-auth-expired',expired);return()=>window.removeEventListener('tiko-auth-expired',expired);},[]);
 if(state==='ready')return <><div className="connection-security" dir="rtl">{config.passkeys&&<button onClick={()=>setSettings(true)}>כניסה במכשיר ומפתחות גישה</button>}<button disabled={busy} onClick={async()=>{setBusy(true);try{await googleTransport().disconnect();}catch{}finally{setBusy(false);setCode('');setError('');setState('code');}}}>יציאה</button></div>{settings&&<PasskeySettings requiresCode={config.requiresCode} onClose={()=>setSettings(false)}/>} {children}</>;
 return <main className="connection-page" dir="rtl"><h1>אוכל לשבת</h1>{state==='loading'?<p role="status">מתחברים למאגר המשפחתי…</p>:<>
  {config.passkeys&&supportsPasskeys()&&<div className="passkey-login"><button type="button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{if(!prepared){setPrepared(await googleTransport().preparePasskeyLogin());}else{const begin=prepared;setPrepared(null);await googleTransport().connectWithPasskey(begin);setState('ready');}}catch(e){setError(passkeyMessage(e));}finally{setBusy(false);}}}>{busy?'ממתינים…':prepared?'אישור כניסה באמצעות המכשיר':'כניסה באמצעות המכשיר'}</button><p>{prepared?'החיבור מוכן. לחצו שוב כדי לפתוח את אישור המכשיר.':'טביעת אצבע, זיהוי פנים או קוד נעילת המכשיר.'}<br/>יש להגדיר מפתח גישה פעם אחת מתוך האפליקציה.</p><span>או כניסה בקוד המשפחתי</span></div>}
  <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await googleTransport().connect(code);setPrepared(null);setCode('');setState('ready');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><label>קוד הכניסה המשפחתי<input type="password" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} disabled={busy} required/></label><button disabled={busy}>{busy?'מתחברים…':'כניסה בקוד'}</button></form></>}{error&&<p role="alert">{error}</p>}</main>;
}
const base=document.querySelector('meta[name="tiko-base"]')?.getAttribute('content')||'/';
const path=location.pathname.slice(base.length).replace(/\/+$/,'');
const screen=path==='install/help'?<InstallInstructions/>:path==='install'?<InstallApp/>:<Connection><Home/></Connection>;
createRoot(document.getElementById('root')!).render(screen);
