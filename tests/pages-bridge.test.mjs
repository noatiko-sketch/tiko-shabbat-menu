import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {trustedGoogleOrigin,googleDeploymentUrl} from '../lib/google-transport.ts';

function server(){
 const code=readFileSync(new URL('../google/Code.gs',import.meta.url),'utf8');
 const sandbox={PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='TIKO_FAMILY_CODE'?'test-family-code':null})}};
 vm.runInNewContext(code,sandbox);return sandbox;
}
test('Pages requests require authorization before reading or writing Drive',()=>{
 const s=server();let called=false;s.readSnapshot_=()=>{called=true;};
 assert.equal(s.pagesRequest({resource:'menu',method:'GET',actor:'נעה'},'wrong').status,401);
 assert.equal(called,false);
 assert.equal(s.pagesRequest({resource:'connect'},'test-family-code').status,200);
});
test('Pages snapshots preserve actor, date and viewed semantics',()=>{
 const s=server();s.readSnapshot_=request=>({...request,status:'ready'});
 const reply=s.pagesRequest({resource:'menu',method:'GET',actor:'נעה',saturday:'2026-11-07',viewed:true},'test-family-code');
 assert.equal(reply.status,200);assert.equal(reply.body.actor,'נעה');assert.equal(reply.body.saturday,'2026-11-07');assert.equal(reply.body.viewed,true);assert.equal(reply.body.compact,true);
});
test('Pages mutations cannot spoof actor or call arbitrary shopping operations',()=>{
 const s=server();s.runAction=action=>action;s.shoppingRequest_=action=>action;
 assert.equal(s.pagesRequest({resource:'menu',method:'POST',actor:'נעה',action:{type:'seen',actor:'אבא'}},'test-family-code').body.actor,'נעה');
 assert.equal(s.pagesRequest({resource:'shopping',method:'POST',actor:'נעה',action:{type:'shopping_scan_reserve'}},'test-family-code').status,400);
 assert.equal(s.pagesRequest({resource:'shopping',method:'POST',actor:'זר',action:{type:'shopping_add'}},'test-family-code').status,401);
});
test('bridge host validation rejects arbitrary origins and secret-bearing URLs',()=>{
 assert.equal(trustedGoogleOrigin('https://script.googleusercontent.com'),true);
 assert.equal(trustedGoogleOrigin('https://abc-script.googleusercontent.com'),true);
 for(const value of ['http://script.googleusercontent.com','https://script.googleusercontent.com.attacker.test','https://attacker.test'])assert.equal(trustedGoogleOrigin(value),false);
 assert.equal(googleDeploymentUrl('https://script.google.com/macros/s/example/exec').hostname,'script.google.com');
 for(const value of ['https://attacker.test/macros/s/example/exec','https://script.google.com/macros/s/example/exec?token=secret'])assert.throws(()=>googleDeploymentUrl(value));
});
test('the invisible Google bridge only processes its configured top-level sender',()=>{
 let listener;const sent=[],calls=[];const top={postMessage:(value,origin)=>sent.push({value,origin})};
 const run={withSuccessHandler(fn){this.ok=fn;return this;},withFailureHandler(){return this;},pagesRequest(payload,code){calls.push({payload,code});this.ok({status:200,body:{ok:true}});}};
 const config={nonce:'test-nonce',parentOrigin:'https://family.github.io',requiresCode:true};
 const script=readFileSync(new URL('../google/Bridge.html',import.meta.url),'utf8').match(/<script>([\s\S]*)<\/script>/)[1].replace('<?!= bridgeConfig ?>',JSON.stringify(config));
 vm.runInNewContext(script,{window:{top,addEventListener:(name,fn)=>{listener=fn;}},google:{script:{run}}});
 assert.equal(sent[0].value.kind,'ready');assert.equal(sent[0].origin,config.parentOrigin);
 const data={channel:'tiko-google-v1',nonce:'test-nonce',kind:'request',id:'1',payload:{resource:'connect'},code:'test-code'};
 listener({source:top,origin:'https://attacker.test',data});listener({source:{},origin:config.parentOrigin,data});listener({source:top,origin:config.parentOrigin,data:{...data,nonce:'wrong'}});assert.equal(calls.length,0);
 listener({source:top,origin:config.parentOrigin,data});assert.equal(calls.length,1);assert.equal(sent[1].value.kind,'reply');assert.equal(JSON.stringify(sent).includes('test-code'),false);
});
