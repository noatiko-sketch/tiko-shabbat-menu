import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import {InstallApp,InstallInstructions} from '../components/family-tools';
import {googleTransport} from '../lib/google-transport';
import {passkeyMessage,supportsPasskeys} from '../lib/passkeys-client';
import {PasskeySettings} from '../components/passkey-settings';
import '../app/globals.css';
import './pages.css';

type PreparedLogin={challengeId:string;options:any;expiresAt:number};
function Connection({children}:{children:React.ReactNode}){
 const [state,setState]=useState<'loading'|'code'|'ready'>('loading'),[code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[settings,setSettings]=useState(false),[config,setConfig]=useState({requiresCode:true,passkeys:false}),[prepared,setPrepared]=useState<PreparedLogin|null>(null),[prepareError,setPrepareError]=useState(false),[attempt,setAttempt]=useState(0),[remember,setRemember]=useState(false);
 const busyRef=useRef(false);busyRef.current=busy;
 useEffect(()=>{let active=true;void googleTransport().ready().then(async config=>{if(!active)return;setConfig(config);if(await googleTransport().restoreRemembered()){if(active)setState('ready');}else if(config.requiresCode){if(active)setState('code');}else{await googleTransport().connect('');if(active)setState('ready');}}).catch(e=>{if(active){setError(e.message);setState('code');}});return()=>{active=false;};},[]);
 useEffect(()=>{const expired=()=>{setSettings(false);setCode('');setError('הכניסה פגה או שבוטלה. יש להיכנס שוב.');setState('code');};window.addEventListener('tiko-auth-expired',expired);return()=>window.removeEventListener('tiko-auth-expired',expired);},[]);
 // Fetch the challenge before the user's click, preserving Safari user activation
 // without an extra confirmation button. Refresh only while the login is visible.
 useEffect(()=>{
  if(state!=='code'||!config.passkeys||!supportsPasskeys())return;
  let active=true,timer:ReturnType<typeof setTimeout>,expires=0;
  const prepare=async()=>{
   if(document.hidden||busyRef.current){timer=setTimeout(prepare,30000);return;}
   setPrepared(null);setPrepareError(false);
   try{const started=Date.now(),begin=await googleTransport().preparePasskeyLogin();if(!active)return;expires=started+240000;setPrepared({...begin,expiresAt:expires});timer=setTimeout(prepare,Math.max(1000,expires-Date.now()));}
   catch{if(active)setPrepareError(true);}
  };
  const visible=()=>{if(!document.hidden&&expires<Date.now()){clearTimeout(timer);void prepare();}};
  void prepare();document.addEventListener('visibilitychange',visible);
  return()=>{active=false;clearTimeout(timer);document.removeEventListener('visibilitychange',visible);};
 },[state,config.passkeys,attempt]);
 if(state==='ready')return <><div className="connection-security" dir="rtl">{config.passkeys&&<button onClick={()=>setSettings(true)}>כניסה במכשיר ומפתחות גישה</button>}<button disabled={busy} onClick={async()=>{setBusy(true);try{await googleTransport().disconnect();}catch{}finally{setBusy(false);setCode('');setPrepared(null);setError('');setState('code');}}}>יציאה</button></div>{googleTransport().notice&&<p className="connection-notice" role="status" dir="rtl">{googleTransport().notice}</p>}{settings&&<PasskeySettings requiresCode={config.requiresCode} onClose={()=>setSettings(false)}/>} {children}</>;
 return <main className="connection-page" dir="rtl"><h1>אוכל לשבת</h1>{state==='loading'?<p role="status">מתחברים למאגר המשפחתי…</p>:<>
  {config.passkeys&&<label className="remember-choice"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} disabled={busy}/>זכור אותי במכשיר זה למשך 30 יום</label>}
  {config.passkeys&&supportsPasskeys()&&<div className="passkey-login"><button type="button" disabled={busy||(!prepared&&!prepareError)} onClick={async()=>{
   if(!prepared||prepared.expiresAt<=Date.now()){setAttempt(x=>x+1);return;}
   const begin=prepared;setPrepared(null);setBusy(true);busyRef.current=true;setError('');
   try{await googleTransport().connectWithPasskey(begin,remember);setState('ready');}catch(e){setError(passkeyMessage(e));}finally{setBusy(false);busyRef.current=false;setAttempt(x=>x+1);}
  }}>{busy?'ממתינים לאישור…':prepareError?'ניסיון הכנת כניסה מחדש':prepared?'כניסה באמצעות המכשיר':'מכינים כניסה במכשיר…'}</button><p>טביעת אצבע, זיהוי פנים או קוד נעילת המכשיר.<br/>יש להגדיר מפתח גישה פעם אחת מתוך האפליקציה.</p><span>או כניסה בקוד המשפחתי</span></div>}
  <form onSubmit={async e=>{e.preventDefault();setBusy(true);busyRef.current=true;setError('');try{await googleTransport().connect(code,remember);setPrepared(null);setCode('');setState('ready');}catch(e){setError((e as Error).message);}finally{setBusy(false);busyRef.current=false;}}}><label>קוד הכניסה המשפחתי<input type="password" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} disabled={busy} required/></label><button disabled={busy}>{busy?'מתחברים…':'כניסה בקוד'}</button></form></>}{error&&<p role="alert">{error}</p>}</main>;
}
const base=document.querySelector('meta[name="tiko-base"]')?.getAttribute('content')||'/';
const path=location.pathname.slice(base.length).replace(/\/+$/,'');
const screen=path==='install/help'?<InstallInstructions/>:path==='install'?<InstallApp/>:<Connection><Home/></Connection>;
createRoot(document.getElementById('root')!).render(screen);
