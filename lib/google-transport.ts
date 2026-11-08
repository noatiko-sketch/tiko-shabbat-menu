import {deviceLabel,readRememberedSession,storeRememberedSession} from './remembered-session.ts';
import {authenticatePasskey} from './passkeys-client.ts';
type Reply={status:number;body:any};
type Pending={resolve:(value:Reply)=>void;reject:(error:Error)=>void;cleanup:()=>void;authSession:string};
const CHANNEL='tiko-google-v1';
// Google can cold-start or wait for the shared Drive lock on mobile networks.
// Keep the form responsive while allowing the authenticated reply to finish.
const AUTH_TIMEOUT_MS=60000;
function abortedRequest(signal:AbortSignal){
 return signal.reason?.name==='TimeoutError'?signal.reason:new DOMException('הבקשה בוטלה. אפשר לנסות שוב.','AbortError');
}
export function trustedGoogleOrigin(origin:string){
 try{const url=new URL(origin);return url.protocol==='https:'&&(url.hostname==='script.googleusercontent.com'||url.hostname.endsWith('-script.googleusercontent.com')||url.hostname.endsWith('.script.googleusercontent.com'));}catch{return false;}
}
export function googleDeploymentUrl(value:string){
 const url=new URL(value);
 if(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)||url.search||url.hash)throw Error('כתובת החיבור לגוגל אינה תקינה.');
 return url;
}

export class GoogleTransport{
 private nonce=crypto.randomUUID();
 private source:MessageEventSource|null=null;
 private origin='';
 private sequence=0;
 private pending=new Map<string,Pending>();
 private readyPromise:Promise<{requiresCode:boolean;passkeys:boolean}>;
 private code='';
 private session='';
 private sessionId='';
 private remembered=false;
 private storageKey:string;
 private cleanups:(()=>void)[]=[];
 private frame:HTMLIFrameElement|null=null;
 notice='';
 constructor(deployment:string){
  const url=googleDeploymentUrl(deployment);
  this.storageKey='tiko-remembered-session-v1:'+url.pathname;
  const storageListener=(event:StorageEvent)=>{if(event.key===this.storageKey&&this.remembered){this.session='';this.code='';this.remembered=false;window.dispatchEvent(new Event('tiko-auth-expired'));}};
  window.addEventListener('storage',storageListener);this.cleanups.push(()=>window.removeEventListener('storage',storageListener));
  url.searchParams.set('pagesBridge','1');url.searchParams.set('parentOrigin',location.origin);url.searchParams.set('nonce',this.nonce);
  this.readyPromise=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('החיבור לגוגל לא נטען. אפשר לנסות להתחבר מחדש.')),45000);
   this.cleanups.push(()=>{clearTimeout(timer);reject(Error('החיבור הופעל מחדש.'));});
   const messageListener=(event:MessageEvent)=>{
    const data=event.data;
    if(!data||data.channel!==CHANNEL||data.nonce!==this.nonce||!trustedGoogleOrigin(event.origin))return;
    if(!this.source&&data.kind==='ready'&&event.source){
     // Apps Script nests its sandbox inside the /exec iframe. Bind the exact
     // authenticated handshake sender, rather than trusting every Google frame.
     this.source=event.source;this.origin=event.origin;clearTimeout(timer);resolve({requiresCode:!!data.requiresCode,passkeys:!!data.passkeys});return;
    }
    if(event.source!==this.source||event.origin!==this.origin||data.kind!=='reply')return;
    const pending=this.pending.get(data.id);if(!pending)return;
    if(!Number.isInteger(data.status)||data.status<200||data.status>599)return;
    this.pending.delete(data.id);pending.cleanup();if(data.status===401&&pending.authSession&&pending.authSession===this.session){this.clearRemembered();this.session='';this.code='';window.dispatchEvent(new Event('tiko-auth-expired'));}pending.resolve({status:data.status,body:data.body});
   };
   window.addEventListener('message',messageListener);this.cleanups.push(()=>window.removeEventListener('message',messageListener));
   const frame=document.createElement('iframe');this.frame=frame;frame.src=url.href;frame.hidden=true;frame.title='חיבור מאובטח למאגר המשפחתי';frame.referrerPolicy='no-referrer';document.body.appendChild(frame);
  });
 }
 dispose(){for(const cleanup of this.cleanups)cleanup();this.cleanups=[];for(const task of this.pending.values()){task.cleanup();task.reject(Error('החיבור הופעל מחדש.'));}this.pending.clear();this.frame?.remove?.();this.source=null;}
 ready(){return this.readyPromise;}
 private clearRemembered(force=false){try{const value=readRememberedSession(localStorage,this.storageKey);if(force||!value||value.token===this.session)localStorage.removeItem(this.storageKey);}catch{}this.remembered=false;}
 private acceptSession(result:any){
  if(typeof result.session!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(result.session)||!Number.isFinite(result.expiresAt)||typeof result.sessionId!=='string')throw Error('לא התקבל אישור כניסה תקין.');
  this.clearRemembered(true);this.session=result.session;this.sessionId=result.sessionId;this.remembered=false;this.notice='';
  if(result.remembered){try{this.remembered=storeRememberedSession(localStorage,this.storageKey,{token:this.session,expiresAt:result.expiresAt,sessionId:this.sessionId});}catch{}if(!this.remembered)this.notice='נכנסת בהצלחה, אך הדפדפן לא מאפשר לשמור כניסה במכשיר הזה.';}
 }
 isRemembered(){return this.remembered;}
 currentSessionId(){return this.sessionId;}
 async restoreRemembered(){
  let saved;try{saved=readRememberedSession(localStorage,this.storageKey);}catch{return false;}if(!saved)return false;
  this.code='';this.session=saved.token;this.sessionId=saved.sessionId;this.remembered=true;
  const renew=saved.expiresAt-Date.now()<30*86400000;
  const reply=await this.request({resource:'connect',...(renew?{remember:true,label:deviceLabel()}: {})},AbortSignal.timeout(AUTH_TIMEOUT_MS));if(reply.status===401)return false;if(reply.status!==200)throw Error('לא ניתן לבדוק את הכניסה השמורה. נסו להתחבר מחדש.');if(reply.body?.session)this.acceptSession(reply.body);return true;
 }
 async connect(code:string,remember=true){await this.ready();this.clearRemembered(true);this.session='';this.code=code;this.notice='';const reply=await this.request({resource:'connect',remember,label:deviceLabel()},AbortSignal.timeout(AUTH_TIMEOUT_MS));if(reply.status!==200){this.code='';throw Error(reply.body?.detail||'לא ניתן להתחבר.');}if(remember&&reply.body?.session)this.acceptSession(reply.body);else if(remember)this.notice='נכנסת בהצלחה. שמירת הכניסה במכשיר אינה זמינה כרגע.';}
 async rememberThisDevice(remember:boolean){const result=await this.passkeyRequest('remember',{remember,label:deviceLabel()});this.acceptSession(result);return this.remembered;}
 hasFamilyCode(){return !!this.code;}
 async passkeyRequest(operation:string,fields:Record<string,unknown>={},code?:string){
  const reply=await this.request({resource:'passkeys',operation,...fields},undefined,code);
  if(reply.status!==200)throw Error(reply.body?.detail||'לא ניתן להשלים את הפעולה.');return reply.body;
 }
 async preparePasskeyLogin(){return this.passkeyRequest('login_begin');}
 async connectWithPasskey(begin:{challengeId:string;options:any},remember=false){
  this.clearRemembered(true);this.code='';this.session='';
  const credential=await authenticatePasskey(begin.options);
  const result=await this.passkeyRequest('login_finish',{challengeId:begin.challengeId,credential,remember,label:deviceLabel()});
  this.acceptSession(result);
 }
 async disconnect(){try{await this.passkeyRequest('logout');}finally{this.clearRemembered(true);this.code='';this.session='';this.sessionId='';}}
 async request(payload:Record<string,unknown>,signal?:AbortSignal,codeOverride?:string):Promise<Reply>{
  await this.ready();if(signal?.aborted)throw abortedRequest(signal);
  const id=String(++this.sequence);
  return new Promise((resolve,reject)=>{
   const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};
   const fail=(error:Error)=>{if(!this.pending.delete(id))return;cleanup();reject(error);};
   const abort=()=>fail(abortedRequest(signal!));
   const timer=setTimeout(()=>fail(Error('השמירה ארכה יותר מדי זמן. יש לרענן לפני ניסיון נוסף.')),60000);
   this.pending.set(id,{resolve,reject,cleanup,authSession:codeOverride===undefined?this.session:''});signal?.addEventListener('abort',abort,{once:true});
   (this.source as Window).postMessage({channel:CHANNEL,nonce:this.nonce,kind:'request',id,payload,code:codeOverride===undefined?this.code:codeOverride,session:codeOverride===undefined?this.session:''},this.origin);
  });
 }
}

let shared:GoogleTransport|undefined;
export function retryGoogleConnection(){shared?.dispose();shared=undefined;return googleTransport();}

export function googleTransport(){
 if(!shared){const url=document.querySelector('meta[name="tiko-google"]')?.getAttribute('content');if(!url)throw Error('חיבור המאגר טרם הוגדר.');shared=new GoogleTransport(url);}
 return shared;
}

export async function apiFetch(input:string,init:RequestInit={}):Promise<Response>{
 if(!document.querySelector('meta[name="tiko-google"]'))return fetch(input,init);
 const url=new URL(input,location.origin),method=init.method||'GET';
 if(!['/api/menu','/api/shopping','/api/shopping/scan'].includes(url.pathname)||!['GET','POST'].includes(method))throw Error('פעולה לא מוכרת.');
 const actor=decodeURIComponent(new Headers(init.headers).get('x-family-member')||'');
 const action=method==='POST'?JSON.parse(String(init.body||'{}')):undefined;
 const reply=await googleTransport().request({resource:url.pathname==='/api/menu'?'menu':url.pathname==='/api/shopping/scan'?'shopping_scan':'shopping',method,actor,action,saturday:url.searchParams.get('saturday'),viewed:url.searchParams.get('viewed')==='1'},init.signal||undefined);
 if(reply.status===200&&url.pathname!=='/api/shopping/scan'){
  const snapshot=method==='GET'?reply.body:reply.body?.snapshot;
  if(snapshot?.status!=='ready'||snapshot?.storage!=='google-drive'||snapshot?.state_id!=='1wc9VbyXuLl9QTWVPLUYiU1vUQjz1vmZI')throw Error('החיבור אינו מצביע על המאגר המשפחתי המקורי.');
 }
 return new Response(JSON.stringify(reply.body),{status:reply.status,headers:{'content-type':'application/json','cache-control':'no-store'}});
}
