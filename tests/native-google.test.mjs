import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GoogleTransport} from '../lib/google-transport.ts';

test('direct Google mode uses native RPC with no bridge iframe and still handles authorization replies',async t=>{
 const keys=['window','document','location','localStorage'],saved=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const win=new EventTarget(),calls=[];let ok,fail;const memory=new Map();
 const run={withSuccessHandler(fn){ok=fn;return this;},withFailureHandler(fn){fail=fn;return this;},pagesRequest(payload,code,session){calls.push({payload,code,session});const callback=ok;queueMicrotask(()=>callback({status:code==='family-code'?200:401,body:code==='family-code'?{connected:true}:{detail:'קוד שגוי'}}));}};
 Object.assign(win,{TIKO_NATIVE_CONFIG:{requiresCode:true},google:{script:{run}}});
 globalThis.window=win;globalThis.location={origin:'https://test-script.googleusercontent.com'};
 globalThis.document={querySelector:()=>({}),createElement:()=>assert.fail('native mode must not create an iframe')};
 globalThis.localStorage={getItem:k=>memory.get(k)||null,removeItem:k=>memory.delete(k),setItem:(k,v)=>memory.set(k,v)};
 t.after(()=>{for(const [key,value] of Object.entries(saved)){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}});
 const client=new GoogleTransport('https://script.google.com/macros/s/test/exec');
 assert.deepEqual(await client.ready(),{requiresCode:true,passkeys:false});
 await assert.rejects(client.connect('wrong',false),/קוד שגוי/);
 await client.connect('family-code',false);assert.equal(client.hasFamilyCode(),true);assert.equal(calls.length,2);assert.equal(calls[1].payload.resource,'connect');
 client.dispose();
});
