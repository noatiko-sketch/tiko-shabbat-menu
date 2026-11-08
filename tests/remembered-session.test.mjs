import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readRememberedSession,storeRememberedSession} from '../lib/remembered-session.ts';
import {GoogleTransport} from '../lib/google-transport.ts';
const token='A'.repeat(43),key='test-key';
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};}
test('saved device sessions reject malformed and expired records and handle blocked storage',()=>{
 const s=storage(),now=Date.now(),valid={token,sessionId:'device-id',expiresAt:now+10000};
 assert.equal(storeRememberedSession(s,key,valid),true);assert.deepEqual(readRememberedSession(s,key,now),valid);
 for(const invalid of [{...valid,token:'wrong'},{...valid,expiresAt:now-1},{...valid,expiresAt:now+367*86400000}]){s.setItem(key,JSON.stringify(invalid));assert.equal(readRememberedSession(s,key,now),null);assert.equal(s.getItem(key),null);}
 assert.equal(readRememberedSession({getItem:()=>{throw Error('blocked');}},key),null);assert.equal(storeRememberedSession({setItem:()=>{throw Error('blocked');}},key,valid),false);
});
function environment(t,{blocked=false,replyDelay=0}={}){
 const s=storage(),requests=[],tokens=new Set();let serial=0;
 const previous=Object.fromEntries(['window','document','location','localStorage'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const win=new EventTarget();globalThis.window=win;globalThis.location={origin:'https://noatiko-sketch.github.io'};globalThis.localStorage=blocked?{...s,setItem:()=>{throw Error('blocked');}}:s;
 const send=(data,source)=>{const event=new Event('message');Object.assign(event,{origin:'https://script.googleusercontent.com',data,source});win.dispatchEvent(event);};
 globalThis.document={createElement:()=>({}),body:{appendChild:frame=>{
  const nonce=new URL(frame.src).searchParams.get('nonce');
  const source={postMessage:message=>{requests.push(message);const {payload,code,session}=message;let body={connected:true},status=200;
   if(payload.resource==='connect'&&!payload.remember){if(!(code==='family-code'||tokens.has(session)))status=401;}
   else if(payload.operation==='remember'||payload.resource==='connect'&&payload.remember){if(!(code==='family-code'||tokens.has(session)))status=401;else{tokens.delete(session);const next=String(++serial).padStart(43,'A');tokens.add(next);body={session:next,sessionId:'device-'+serial,expiresAt:Date.now()+(payload.remember?365*24:8)*3600000,remembered:payload.remember};}}
   else if(payload.operation==='logout'){tokens.delete(session);}
   const reply=()=>send({...message,kind:'reply',status,body},source);
   if(replyDelay)setTimeout(reply,replyDelay);else queueMicrotask(reply);
  }};queueMicrotask(()=>send({channel:'tiko-google-v1',nonce,kind:'ready',requiresCode:true,passkeys:true},source));
 }}};
 t.after(()=>{for(const [k,descriptor] of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k];}});
 const create=()=>new GoogleTransport('https://script.google.com/macros/s/test-deployment/exec');return {s,requests,tokens,create};
}
test('automatic remembered login survives a new page instance, validates server-side, never stores the code, and logout forgets the device',async t=>{
 const e=environment(t),first=e.create();await first.ready();await first.connect('family-code');assert.equal(first.isRemembered(),true);assert.equal(e.requests.length,1,'password and persistence use one request');assert.equal(JSON.stringify([...e.s.map]).includes('family-code'),false);
 const second=e.create();await second.ready();assert.equal(await second.restoreRemembered(),true);assert.equal(second.hasFamilyCode(),false);assert.equal(e.requests.at(-1).code,'');assert.equal(e.requests.at(-1).payload.resource,'connect');
 await second.disconnect();assert.equal(e.s.map.size,0);const third=e.create();await third.ready();assert.equal(await third.restoreRemembered(),false);
});
test('revoked device tokens are removed; ordinary login is not persisted; blocked storage leaves current login working',async t=>{
 const e=environment(t),first=e.create();await first.ready();await first.connect('family-code',false);assert.equal(e.s.map.size,0);await first.rememberThisDevice(true);e.tokens.clear();
 const second=e.create();await second.ready();assert.equal(await second.restoreRemembered(),false);assert.equal(e.s.map.size,0);assert.equal(second.isRemembered(),false);
});
test('turning off remember rotates the token and leaves only a tab session',async t=>{
 const e=environment(t),first=e.create();await first.ready();await first.connect('family-code',true);const old=[...e.tokens][0];await first.rememberThisDevice(false);assert.equal(first.isRemembered(),false);assert.equal(e.tokens.has(old),false);assert.equal(e.s.map.size,0);assert.equal((await first.request({resource:'connect'})).status,200);
});
test('blocked storage is disclosed without breaking a successful login',async t=>{
 const e=environment(t,{blocked:true}),first=e.create();await first.ready();await first.connect('family-code',true);assert.equal(first.isRemembered(),false);assert.match(first.notice,/הדפדפן/);assert.equal((await first.request({resource:'connect'})).status,200);
});

test('year-long sessions are accepted and a near-expiry device renews during its single restore request',async t=>{
 const e=environment(t),client=e.create();await client.ready();await client.connect('family-code');
 const [storageKey]=e.s.map.keys(),saved=JSON.parse(e.s.getItem(storageKey));
 assert.ok(saved.expiresAt>Date.now()+364*86400000);
 saved.expiresAt=Date.now()+10*86400000;e.s.setItem(storageKey,JSON.stringify(saved));
 const next=e.create();await next.ready();const before=e.requests.length;assert.equal(await next.restoreRemembered(),true);
 assert.equal(e.requests.length,before+1);assert.equal(e.requests.at(-1).payload.remember,true);
 assert.notEqual(JSON.parse(e.s.getItem(storageKey)).token,saved.token);assert.equal(e.tokens.has(saved.token),false);
});

test('disposing the old connection removes it without erasing a saved device token',async t=>{
 const e=environment(t),client=e.create();await client.ready();await client.connect('family-code');
 const before=[...e.s.map];client.dispose();assert.deepEqual([...e.s.map],before);
 const fresh=e.create();await fresh.ready();assert.equal(await fresh.restoreRemembered(),true);
});

function timedEnvironment(t,replyDelay){
 t.mock.timers.enable({apis:['setTimeout']});
 // Node's native AbortSignal.timeout uses internal timers, so model browser
 // timeout signals with the same clock as the bridge in these isolated tests.
 t.mock.method(AbortSignal,'timeout',ms=>{const controller=new AbortController();setTimeout(()=>controller.abort(new DOMException('Timed out','TimeoutError')),ms);return controller.signal;});
 return environment(t,{replyDelay});
}
test('a slow Google password reply beyond the former 20-second limit still signs in once',async t=>{
 const e=timedEnvironment(t,25000),client=e.create();await client.ready();
 let finished=false;const login=client.connect('family-code').then(()=>{finished=true;});
 await Promise.resolve();await Promise.resolve();
 t.mock.timers.tick(20001);await Promise.resolve();assert.equal(finished,false);
 t.mock.timers.tick(4999);await login;
 assert.equal(client.isRemembered(),true);assert.equal(e.requests.length,1);
});
test('a slow remembered-session check is not rejected after 15 seconds',async t=>{
 const e=timedEnvironment(t,25000),first=e.create();await first.ready();
 const login=first.connect('family-code');await Promise.resolve();await Promise.resolve();t.mock.timers.tick(25000);await login;
 const second=e.create();await second.ready();const restored=second.restoreRemembered();
 await Promise.resolve();t.mock.timers.tick(25000);assert.equal(await restored,true);
});
test('a missing Google reply preserves TimeoutError for the Hebrew UI and ignores late success',async t=>{
 const e=timedEnvironment(t,70000),client=e.create();await client.ready();
 const login=client.connect('family-code');const rejected=assert.rejects(login,{name:'TimeoutError'});
 await Promise.resolve();await Promise.resolve();t.mock.timers.tick(60000);await rejected;
 t.mock.timers.tick(10000);assert.equal(client.isRemembered(),false);assert.equal(e.s.map.size,0);
});
test('already timed-out requests retain their reason without sending a request',async t=>{
 const e=environment(t),client=e.create();await client.ready();
 const controller=new AbortController();controller.abort(new DOMException('Timed out','TimeoutError'));
 await assert.rejects(client.request({resource:'connect'},controller.signal),{name:'TimeoutError'});assert.equal(e.requests.length,0);
});
