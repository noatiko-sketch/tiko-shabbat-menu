import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash,createHmac,generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {encodeCBOR} from '@levischuck/tiny-cbor';
const origin='https://noatiko-sketch.github.io',rp='noatiko-sketch.github.io',code='test-family-code';
const b64=v=>Buffer.from(v).toString('base64url');
const hash=v=>createHash('sha256').update(v).digest();
function server(){
 let state={sentinel:'original-family-data'},locked=false,now=Date.now();
 const props={TIKO_FAMILY_CODE:code,TIKO_BRIDGE_TOKEN:'private-test-secret-'.repeat(3)};
 const file={getBlob:()=>({getDataAsString:()=>JSON.stringify(state)}),setContent:value=>{assert.equal(locked,true);state=JSON.parse(value);}};
 class Clock extends Date{static now(){return now;}}
 const s={Date:Clock,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null})},DriveApp:{getFileById:()=>file},LockService:{getScriptLock:()=>({tryLock:()=>{assert.equal(locked,false);locked=true;return true;},releaseLock:()=>{locked=false;}})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,v)=>Array.from(hash(Buffer.from(v))),computeHmacSha256Signature:(v,k)=>Array.from(createHmac('sha256',k).update(v).digest()),getUuid:randomUUID}};
 vm.runInNewContext(readFileSync(new URL('../google/Code.gs',import.meta.url),'utf8'),s);
 return {s,props,get state(){return state;},advance:ms=>{now+=ms;},call:(operation,fields={},password=code,session='')=>s.pagesRequest({resource:'passkeys',operation,...fields},password,session)};
}
function device(){const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=publicKey.export({format:'jwk'}),id=b64(Buffer.from(randomUUID()));return {privateKey,jwk,id};}
function client(challenge,type,overrides={}){return Buffer.from(JSON.stringify({type,challenge:challenge.options.challenge,origin,crossOrigin:false,...overrides}));}
function authData({flags=5,counter=0,rpId=rp}={}){const n=Buffer.alloc(4);n.writeUInt32BE(counter);return Buffer.concat([hash(rpId),Buffer.from([flags]),n]);}
function registration(d,ch,overrides={}){
 const cose=encodeCBOR(new Map([[1,2],[3,-7],[-1,1],[-2,new Uint8Array(Buffer.from(d.jwk.x,'base64url'))],[-3,new Uint8Array(Buffer.from(d.jwk.y,'base64url'))]]));
 const id=Buffer.from(d.id,'base64url'),len=Buffer.alloc(2);len.writeUInt16BE(id.length);
 const data=Buffer.concat([authData({flags:69,...overrides}),Buffer.alloc(16),len,id,cose]);
 return {id:d.id,rawId:d.id,type:'public-key',response:{clientDataJSON:b64(client(ch,'webauthn.create',overrides.client)),attestationObject:b64(encodeCBOR(new Map([['fmt','none'],['attStmt',new Map()],['authData',new Uint8Array(data)]])))}};
}
function assertion(d,ch,overrides={}){const data=authData(overrides),json=client(ch,'webauthn.get',overrides.client),signature=sign('sha256',Buffer.concat([data,hash(json)]),d.privateKey);return {id:d.id,rawId:d.id,type:'public-key',response:{clientDataJSON:b64(json),authenticatorData:b64(data),signature:b64(signature),userHandle:overrides.userHandle??null}};}
function enroll(env,d=device()){const begin=env.call('register_begin',{label:'אבא — גלקסי'});assert.equal(begin.status,200);const finish=env.call('register_finish',{challengeId:begin.body.challengeId,credential:registration(d,begin.body)});assert.equal(finish.status,200,JSON.stringify(finish));return d;}
function login(env,d,overrides={}){const begin=env.call('login_begin',{},'');assert.equal(begin.status,200);return {begin,...env.call('login_finish',{challengeId:begin.body.challengeId,credential:assertion(d,begin.body,overrides)},'')};}
test('Apps Script without WebCrypto enrolls and verifies real ES256 signatures; tokens are hashed and revocation is immediate',()=>{
 const e=server(),d=enroll(e);assert.equal(e.s.passkeysAvailable_(),true);
 const logged=login(e,d);assert.equal(logged.status,200,JSON.stringify(logged));const token=logged.body.session;
 assert.equal(e.s.pagesRequest({resource:'connect'},'',token).status,200);
 assert.equal(JSON.stringify(e.state).includes(token),false);assert.equal(e.state.sentinel,'original-family-data');
 assert.equal(e.call('list',{},'',token).status,401);
 assert.equal(e.call('register_begin',{label:'untrusted'},'',token).status,401);
 assert.equal(e.call('revoke',{credentialId:d.id},'',token).status,401);
 const listed=e.call('list').body.credentials[0];assert.equal(listed.publicKey,undefined);assert.equal(listed.label,'אבא — גלקסי');
 assert.equal(e.call('revoke',{credentialId:d.id}).status,200);
 assert.equal(e.s.pagesRequest({resource:'connect'},'',token).status,401);assert.equal(login(e,d).status,401);
});
test('challenge replay, expiry, wrong origin/RP, missing presence/verification, wrong key and user handle are rejected',()=>{
 const e=server(),d=enroll(e),first=login(e,d);assert.equal(first.status,200);
 assert.equal(e.call('login_finish',{challengeId:first.begin.body.challengeId,credential:assertion(d,first.begin.body)},'').status,401);
 for(const overrides of [{client:{origin:'https://attacker.test'}},{client:{crossOrigin:true}},{client:{challenge:'wrong'}},{rpId:'attacker.test'},{flags:1},{flags:4},{userHandle:'wrong'}])assert.notEqual(login(e,d,overrides).status,200,JSON.stringify(overrides));
 const begin=e.call('login_begin',{},'').body,other=device();other.id=d.id;
 assert.equal(e.call('login_finish',{challengeId:begin.challengeId,credential:assertion(other,begin)},'').status,401);
 assert.equal(e.call('login_finish',{challengeId:begin.challengeId,credential:assertion(d,begin)},'').status,401,'failure consumes challenge');
 const expired=e.call('login_begin',{},'').body;e.advance(300001);assert.equal(e.call('login_finish',{challengeId:expired.challengeId,credential:assertion(d,expired)},'').status,401);
});
test('registration requires code, trusted origin, valid RP hash and user verification',()=>{
 for(const overrides of [{client:{origin:'https://attacker.test'}},{rpId:'attacker.test'},{flags:65}]){const e=server(),d=device(),begin=e.call('register_begin',{label:'phone'}).body;assert.notEqual(e.call('register_finish',{challengeId:begin.challengeId,credential:registration(d,begin,overrides)}).status,200);assert.equal(e.state.passkeys_v1.credentials.length,0);}
 const e=server();assert.equal(e.call('register_begin',{label:'phone'},'wrong').status,401);assert.equal(e.call('list',{},'wrong').status,401);
});
test('counter rollback is rejected, synced zero counters work, session expiry and recovery code changes invalidate access',()=>{
 const e=server(),d=enroll(e);assert.equal(login(e,d,{counter:2}).status,200);assert.equal(login(e,d,{counter:1}).status,401);assert.equal(login(e,d,{counter:0}).status,401,'a positive signature counter cannot reset to zero');
 const e2=server(),d2=enroll(e2);assert.equal(login(e2,d2).status,200);const logged=login(e2,d2);assert.equal(logged.status,200);
 e2.props.TIKO_FAMILY_CODE='new-code';assert.equal(e2.s.pagesRequest({resource:'connect'},'',logged.body.session).status,401);
 e2.props.TIKO_FAMILY_CODE=code;e2.advance(8*60*60*1000+1);assert.equal(e2.s.pagesRequest({resource:'connect'},'',logged.body.session).status,401);
});
test('outstanding anonymous challenges are bounded and logout removes a session',()=>{
 const e=server(),d=enroll(e),logged=login(e,d);assert.equal(e.call('logout',{},'',logged.body.session).status,200);assert.equal(e.s.pagesRequest({resource:'connect'},'',logged.body.session).status,401);
 for(let i=0;i<30;i++)assert.equal(e.call('login_begin',{},'').status,200);
 assert.equal(e.call('login_begin',{},'').status,429);e.advance(300001);assert.equal(e.call('login_begin',{},'').status,200);
});
test('family menu and shopping snapshots never expose private passkey records',()=>{
 const e=server();enroll(e);const ctx={upcoming:'2026-11-07',today:'2026-11-07',now:'2026-11-07T08:00:00Z'},state=e.state;
 state.anchor_saturday='2026-09-26';state.anchor_week=1;state.history=[];state.deliveries=[];
 e.s.TikoDrive.initializeDrive(state,'',ctx);
 for(const snapshot of [e.s.TikoDrive.driveSnapshot(state,ctx.upcoming,ctx,true,true),e.s.TikoDrive.shoppingSnapshot(state)]){
  assert.equal(snapshot.passkeys_v1,undefined);assert.equal(JSON.stringify(snapshot).includes(state.passkeys_v1.credentials[0].publicKey),false);
 }
});
test('generated verifier uses BigInt constructors accepted by the Apps Script upload parser',async()=>{
 const ts=await import('typescript');
 const source=ts.createSourceFile('Code.js',readFileSync(new URL('../google/Code.gs',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const visit=node=>{assert.equal(ts.isBigIntLiteral(node),false);ts.forEachChild(node,visit);};visit(source);
});
test('remembered code login lasts 30 days, stores only a token hash and is revocable without a passkey',()=>{
 const e=server();assert.equal(e.call('remember',{remember:true},'wrong').status,401);
 const r=e.call('remember',{remember:true,label:'אנדרואיד'});assert.equal(r.status,200);
 const token=r.body.session;assert.equal(e.state.passkeys_v1.credentials.length,0);assert.equal(e.state.passkeys_v1.sessions[0].authMethod,'code');assert.equal(JSON.stringify(e.state).includes(token),false);
 e.advance(2*24*60*60*1000);assert.equal(e.s.pagesRequest({resource:'connect'},'',token).status,200);
 const list=e.call('list');assert.equal(list.body.devices.length,1);assert.equal(list.body.devices[0].label,'אנדרואיד');assert.equal(list.body.devices[0].hash,undefined);
 assert.equal(e.call('revoke_device',{deviceId:r.body.sessionId},'',token).status,401);
 assert.equal(e.call('revoke_device',{deviceId:r.body.sessionId}).status,200);assert.equal(e.s.pagesRequest({resource:'connect'},'',token).status,401);
});
test('remembered Passkey login still requires a real signature and expires or is invalidated by key revocation',()=>{
 const e=server(),d=enroll(e),begin=e.call('login_begin',{},'').body;
 const r=e.call('login_finish',{challengeId:begin.challengeId,credential:assertion(d,begin),remember:true,label:'אייפון'},'');assert.equal(r.status,200);assert.equal(r.body.remembered,true);
 e.advance(29*24*60*60*1000);assert.equal(e.s.pagesRequest({resource:'connect'},'',r.body.session).status,200);
 e.call('revoke',{credentialId:d.id});assert.equal(e.s.pagesRequest({resource:'connect'},'',r.body.session).status,401);
 const e2=server(),r2=e2.call('remember',{remember:true});e2.advance(30*24*60*60*1000+1);assert.equal(e2.s.pagesRequest({resource:'connect'},'',r2.body.session).status,401);
});
test('forgetting replaces the remembered token with an eight-hour session; logout and code rotation revoke access',()=>{
 const e=server(),saved=e.call('remember',{remember:true}).body;
 const short=e.call('remember',{remember:false},'',saved.session);assert.equal(short.status,200);assert.equal(short.body.remembered,false);
 assert.equal(e.s.pagesRequest({resource:'connect'},'',saved.session).status,401);assert.equal(e.s.pagesRequest({resource:'connect'},'',short.body.session).status,200);assert.equal(e.call('list').body.devices.length,0);
 e.advance(8*60*60*1000+1);assert.equal(e.s.pagesRequest({resource:'connect'},'',short.body.session).status,401);
 const rotated=e.call('remember',{remember:true}).body;e.props.TIKO_FAMILY_CODE='different';assert.equal(e.s.pagesRequest({resource:'connect'},'',rotated.session).status,401);
 e.props.TIKO_FAMILY_CODE=code;const logged=e.call('remember',{remember:true}).body;assert.equal(e.call('logout',{},'',logged.session).status,200);assert.equal(e.s.pagesRequest({resource:'connect'},'',logged.session).status,401);
 assert.equal(e.call('remember',{remember:true},'',saved.session).status,401,'revoked sessions cannot mint new tokens');
});
