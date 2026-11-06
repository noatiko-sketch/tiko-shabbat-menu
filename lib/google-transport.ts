type Reply={status:number;body:any};
type Pending={resolve:(value:Reply)=>void;reject:(error:Error)=>void;cleanup:()=>void};
const CHANNEL='tiko-google-v1';
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
 private readyPromise:Promise<{requiresCode:boolean}>;
 private code='';
 constructor(deployment:string){
  const url=googleDeploymentUrl(deployment);
  url.searchParams.set('pagesBridge','1');url.searchParams.set('parentOrigin',location.origin);url.searchParams.set('nonce',this.nonce);
  this.readyPromise=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('החיבור לגוגל לא נטען. אפשר לרענן ולנסות שוב.')),30000);
   window.addEventListener('message',event=>{
    const data=event.data;
    if(!data||data.channel!==CHANNEL||data.nonce!==this.nonce||!trustedGoogleOrigin(event.origin))return;
    if(!this.source&&data.kind==='ready'&&event.source){
     // Apps Script nests its sandbox inside the /exec iframe. Bind the exact
     // authenticated handshake sender, rather than trusting every Google frame.
     this.source=event.source;this.origin=event.origin;clearTimeout(timer);resolve({requiresCode:!!data.requiresCode});return;
    }
    if(event.source!==this.source||event.origin!==this.origin||data.kind!=='reply')return;
    const pending=this.pending.get(data.id);if(!pending)return;
    if(!Number.isInteger(data.status)||data.status<200||data.status>599)return;
    this.pending.delete(data.id);pending.cleanup();pending.resolve({status:data.status,body:data.body});
   });
   const frame=document.createElement('iframe');frame.src=url.href;frame.hidden=true;frame.title='חיבור מאובטח למאגר המשפחתי';frame.referrerPolicy='no-referrer';document.body.appendChild(frame);
  });
 }
 ready(){return this.readyPromise;}
 async connect(code:string){this.code=code;const reply=await this.request({resource:'connect'});if(reply.status!==200){this.code='';throw Error(reply.body?.detail||'לא ניתן להתחבר.');}}
 async request(payload:Record<string,unknown>,signal?:AbortSignal):Promise<Reply>{
  await this.ready();if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const id=String(++this.sequence);
  return new Promise((resolve,reject)=>{
   const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};
   const fail=(error:Error)=>{if(!this.pending.delete(id))return;cleanup();reject(error);};
   const abort=()=>fail(new DOMException('Aborted','AbortError'));
   const timer=setTimeout(()=>fail(Error('השמירה ארכה יותר מדי זמן. יש לרענן לפני ניסיון נוסף.')),60000);
   this.pending.set(id,{resolve,reject,cleanup});signal?.addEventListener('abort',abort,{once:true});
   (this.source as Window).postMessage({channel:CHANNEL,nonce:this.nonce,kind:'request',id,payload,code:this.code},this.origin);
  });
 }
}

let shared:GoogleTransport|undefined;
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
