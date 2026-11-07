import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readRememberedSession,storeRememberedSession} from '../lib/remembered-session.ts';
import {GoogleTransport} from '../lib/google-transport.ts';
const token='A'.repeat(43),key='test-key';
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};}
test('saved device sessions reject malformed and expired records and handle blocked storage',()=>{
 const s=storage(),now=Date.now(),valid={token,sessionId:'device-id',expiresAt:now+10000};
 assert.equal(storeRememberedSession(s,key,valid),true);assert.deepEqual(readRememberedSession(s,key,now),valid);
 for(const invalid of [{...valid,token:'wrong'},{...valid,expiresAt:now-1},{...valid,expiresAt:now+32*86400000}]){s.setItem(key,JSON.stringify(invalid));assert.equal(readRememberedSession(s,key,now),null);assert.equal(s.getItem(key),null);}
 assert.equal(readRememberedSession({getItem:()=>{throw Error('blocked');}},key),null);assert.equal(storeRememberedSession({setItem:()=>{throw Error('blocked');}},key,valid),false);
});
function environment(t,{blocked=false}={}){
 const s=storage(),requests=[],tokens=new Set();let serial=0;
 const previous=Object.fromEntries(['window','document','location','localStorage'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const win=new EventTarget();globalThis.window=win;globalThis.location={origin:'https://noatiko-sketch.github.io'};globalThis.localStorage=blocked?{...s,setItem:()=>{throw Error('blocked');}}:s;
 const send=(data,source)=>{const event=new Event('message');Object.assign(event,{origin:'https://script.googleusercontent.com',data,source});win.dispatchEvent(event);};
 globalThis.document={createElement:()=>({}),body:{appendChild:frame=>{
  const nonce=new URL(frame.src).searchParams.get('nonce');
  const source={postMessage:message=>{requests.push(message);const {payload,code,session}=message;let body={connected:true},status=200;
   if(payload.resource==='connect'){if(!(code==='family-code'||tokens.has(session)))status=401;}
   else if(payload.operation==='remember'){if(!(code==='family-code'||tokens.has(session)))status=401;else{tokens.delete(session);const next=String(++serial).padStart(43,'A');tokens.add(next);body={session:next,sessionId:'device-'+serial,expiresAt:Date.now()+(payload.remember?30*24:8)*3600000,remembered:payload.remember};}}
   else if(payload.operation==='logout'){tokens.delete(session);}
   queueMicrotask(()=>send({...message,kind:'reply',status,body},source));
  }};queueMicrotask(()=>send({channel:'tiko-google-v1',nonce,kind:'ready',requiresCode:true,passkeys:true},source));
 }}};
 t.after(()=>{for(const [k,descriptor] of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k];}});
 const create=()=>new GoogleTransport('https://script.google.com/macros/s/test-deployment/exec');return {s,requests,tokens,create};
}
test('opt-in survives a new page instance, validates server-side, never stores the code, and logout forgets the device',async t=>{
 const e=environment(t),first=e.create();await first.ready();await first.connect('family-code',true);assert.equal(first.isRemembered(),true);assert.equal(JSON.stringify([...e.s.map]).includes('family-code'),false);
 const second=e.create();await second.ready();assert.equal(await second.restoreRemembered(),true);assert.equal(second.hasFamilyCode(),false);assert.equal(e.requests.at(-1).code,'');assert.equal(e.requests.at(-1).payload.resource,'connect');
 await second.disconnect();assert.equal(e.s.map.size,0);const third=e.create();await third.ready();assert.equal(await third.restoreRemembered(),false);
});
test('revoked device tokens are removed; ordinary login is not persisted; blocked storage leaves current login working',async t=>{
 const e=environment(t),first=e.create();await first.ready();await first.connect('family-code');assert.equal(e.s.map.size,0);await first.rememberThisDevice(true);e.tokens.clear();
 const second=e.create();await second.ready();assert.equal(await second.restoreRemembered(),false);assert.equal(e.s.map.size,0);assert.equal(second.isRemembered(),false);
});
test('turning off remember rotates the token and leaves only a tab session',async t=>{
 const e=environment(t),first=e.create();await first.ready();await first.connect('family-code',true);const old=[...e.tokens][0];await first.rememberThisDevice(false);assert.equal(first.isRemembered(),false);assert.equal(e.tokens.has(old),false);assert.equal(e.s.map.size,0);assert.equal((await first.request({resource:'connect'})).status,200);
});
test('blocked storage is disclosed without breaking a successful login',async t=>{
 const e=environment(t,{blocked:true}),first=e.create();await first.ready();await first.connect('family-code',true);assert.equal(first.isRemembered(),false);assert.match(first.notice,/הדפדפן/);assert.equal((await first.request({resource:'connect'})).status,200);
});
