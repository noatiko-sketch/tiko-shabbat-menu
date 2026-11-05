import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import {InstallApp,InstallInstructions} from '../components/family-tools';
import {googleTransport} from '../lib/google-transport';
import '../app/globals.css';
import './pages.css';

function Connection({children}:{children:React.ReactNode}){
 const [state,setState]=useState<'loading'|'code'|'ready'>('loading'),[code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;void googleTransport().ready().then(async config=>{if(!active)return;if(config.requiresCode)setState('code');else{await googleTransport().connect('');if(active)setState('ready');}}).catch(e=>{if(active){setError(e.message);setState('code');}});return()=>{active=false;};},[]);
 if(state==='ready')return children;
 return <main className="connection-page" dir="rtl"><h1>אוכל לשבת</h1>{state==='loading'?<p role="status">מתחברים למאגר המשפחתי…</p>:<form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await googleTransport().connect(code);setCode('');setState('ready');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><label>קוד הכניסה המשפחתי<input type="password" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} disabled={busy} required autoFocus/></label><button disabled={busy}>{busy?'מתחברים…':'כניסה'}</button></form>}{error&&<p role="alert">{error}</p>}</main>;
}
const base=document.querySelector('meta[name="tiko-base"]')?.getAttribute('content')||'/';
const path=location.pathname.slice(base.length).replace(/\/+$/,'');
const screen=path==='install/help'?<InstallInstructions/>:path==='install'?<InstallApp/>:<Connection><Home/></Connection>;
createRoot(document.getElementById('root')!).render(screen);
