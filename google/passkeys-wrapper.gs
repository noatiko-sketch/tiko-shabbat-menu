/** Passkey records live privately in the original family file; snapshots never include them. */
function passkeysAvailable_(){return typeof TikoPasskeys!=='undefined'&&typeof BigInt==='function'&&String(PropertiesService.getScriptProperties().getProperty('TIKO_BRIDGE_TOKEN')||'').length>=32;}
function passkeyOrigin_(){var origin=PropertiesService.getScriptProperties().getProperty('TIKO_PAGES_ORIGIN')||'https://noatiko-sketch.github.io';if(!/^https:\/\/[a-z0-9.-]+$/.test(origin))throw {status:503,message:'כתובת האתר למפתחות גישה אינה מוגדרת נכון.'};return origin;}
function passkeyHash_(bytes){return Uint8Array.from(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,Array.from(bytes,function(n){return n>127?n-256:n;})),function(n){return n&255;});}
function passkeyHmac_(text){var secret=PropertiesService.getScriptProperties().getProperty('TIKO_BRIDGE_TOKEN');if(!secret||secret.length<32)throw {status:503,message:'כניסה באמצעות מכשיר אינה זמינה כרגע. השתמשו בקוד המשפחתי.'};return TikoPasskeys.toBase64url(Uint8Array.from(Utilities.computeHmacSha256Signature(text,secret),function(n){return n&255;}));}
function passkeyRandom_(){return passkeyHmac_('random:'+Utilities.getUuid()+':'+Utilities.getUuid()+':'+Date.now());}
function passkeyCodeVersion_(){return passkeyHmac_('family-code:'+String(PropertiesService.getScriptProperties().getProperty('TIKO_FAMILY_CODE')||''));}
function passkeyTokenHash_(token){return TikoPasskeys.toBase64url(passkeyHash_(TikoPasskeys.passkeyBytes(token)));}
function passkeyRead_(){var file=DriveApp.getFileById(TIKO.state),state=JSON.parse(file.getBlob().getDataAsString('UTF-8'));return {file:file,state:state,auth:state.passkeys_v1||TikoPasskeys.newPasskeyState()};}
function withPasskeyState_(fn){return locked_(function(){var record=passkeyRead_(),before=JSON.stringify(record.auth);TikoPasskeys.prunePasskeys(record.auth,Date.now());try{return fn(record.auth);}finally{if(JSON.stringify(record.auth)!==before){record.state.passkeys_v1=record.auth;save_(record.state,record.file);}}});}
function passkeyFindSession_(auth,token,now){
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
 var hash=passkeyTokenHash_(token),version=passkeyCodeVersion_();
 return auth.sessions.find(function(s){return s.hash===hash&&s.expires>now&&s.codeVersion===version&&(s.credentialId?auth.credentials.some(function(c){return c.id===s.credentialId;}):s.authMethod==='code');})||null;
}
function authorizePasskeySession_(token){
 if(!passkeysAvailable_()||!passkeyFindSession_(passkeyRead_().auth,token,Date.now()))throw {status:401,message:'הכניסה פגה או שבוטלה. יש להיכנס שוב.'};
}
function issuePasskeySession_(auth,credentialId,remember,label,now){
 var token=passkeyRandom_(),entry={id:Utilities.getUuid(),hash:passkeyTokenHash_(token),expires:now+(remember?30*24:8)*60*60*1000,codeVersion:passkeyCodeVersion_(),remembered:remember,createdAt:now,label:typeof label==='string'?label.trim().slice(0,60):'המכשיר הזה'};
 if(credentialId)entry.credentialId=credentialId;else entry.authMethod='code';
 auth.sessions=auth.sessions.slice(-59);auth.sessions.push(entry);
 return {connected:true,session:token,sessionId:entry.id,expiresAt:entry.expires,remembered:remember};
}
function passkeysRequest_(request,code,session){
 try{
  if(!passkeysAvailable_())throw {status:503,message:'כניסה באמצעות מכשיר אינה זמינה כרגע. השתמשו בקוד המשפחתי.'};
  if(!request||typeof request!=='object'||!['login_begin','login_finish','register_begin','register_finish','list','revoke','logout','remember','revoke_device'].includes(request.operation))throw {status:400,message:'פעולת כניסה לא מוכרת.'};
  var op=request.operation,origin=passkeyOrigin_(),rpId=origin.slice(8);
  // Enrollment and revocation always require the recovery code (or the existing owner login).
  if(!op.startsWith('login_')){try{if(op==='logout'||op==='remember')authorize_(code,session);else authorize_(code);}catch(error){throw {status:401,message:'יש להזין את הקוד המשפחתי כדי לנהל מפתחות גישה.'};}}
  var result=withPasskeyState_(function(auth){
   var now=Date.now();
   if(op==='list')return {credentials:auth.credentials.map(function(c){return {id:c.id,label:c.label,createdAt:c.createdAt,lastUsedAt:c.lastUsedAt};}),devices:auth.sessions.filter(function(s){return s.remembered&&s.codeVersion===passkeyCodeVersion_();}).map(function(s){return {id:s.id,label:s.label,createdAt:s.createdAt,expiresAt:s.expires};})};
   if(op==='remember'){
    var previous=session?passkeyFindSession_(auth,session,now):null;
    if(session&&!previous)throw {status:401,message:'הכניסה פגה. יש להיכנס שוב.'};
    if(session)auth.sessions=auth.sessions.filter(function(s){return s.hash!==previous.hash;});
    return issuePasskeySession_(auth,previous&&previous.credentialId,request.remember===true,request.label,now);
   }
   if(op==='revoke_device'){
    if(typeof request.deviceId!=='string')throw {status:400,message:'מכשיר לא תקין.'};
    auth.sessions=auth.sessions.filter(function(s){return !(s.remembered&&s.id===request.deviceId);});return {revoked:true};
   }
   if(op==='revoke'){
    if(typeof request.credentialId!=='string')throw {status:400,message:'מפתח גישה לא תקין.'};
    auth.credentials=auth.credentials.filter(function(c){return c.id!==request.credentialId;});
    auth.sessions=auth.sessions.filter(function(s){return s.credentialId!==request.credentialId;});return {revoked:true};
   }
   if(op==='logout'){if(session)auth.sessions=auth.sessions.filter(function(s){return s.hash!==passkeyTokenHash_(session);});return {loggedOut:true};}
   if(op==='login_begin'||op==='register_begin'){
    if(auth.challenges.length>=30)throw {status:429,message:'יש יותר מדי ניסיונות כניסה. המתינו כמה דקות או השתמשו בקוד המשפחתי.'};
    var challenge={id:Utilities.getUuid(),value:passkeyRandom_(),purpose:op==='register_begin'?'register':'login',expires:now+5*60*1000};
    if(op==='register_begin'){
     if(auth.credentials.length>=20)throw {status:400,message:'יש כבר 20 מפתחות גישה למשפחה. יש לבטל מפתח ישן לפני הוספה.'};
     var label=typeof request.label==='string'?request.label.trim():'';
     if(!label||label.length>60)throw {status:400,message:'יש לתת למכשיר שם של עד 60 תווים.'};
     challenge.label=label;challenge.userId=passkeyHmac_('family-user:'+rpId);
    }
    auth.challenges.push(challenge);
    if(op==='login_begin')return {challengeId:challenge.id,expiresAt:challenge.expires,options:{challenge:challenge.value,rpId:rpId,timeout:120000,userVerification:'required'}};
    return {challengeId:challenge.id,options:{challenge:challenge.value,rp:{name:'טיקו — משפחת טיקו',id:rpId},user:{id:challenge.userId,name:'משפחת טיקו',displayName:'משפחת טיקו'},pubKeyCredParams:[{type:'public-key',alg:-7}],attestation:'none',authenticatorSelection:{residentKey:'required',requireResidentKey:true,userVerification:'required'},timeout:120000,excludeCredentials:auth.credentials.map(function(c){return {type:'public-key',id:c.id};})}};
   }
   var challenge=TikoPasskeys.takePasskeyChallenge(auth,request.challengeId,op==='register_finish'?'register':'login',now);
   if(op==='register_finish'){
    if(auth.credentials.length>=20)throw {status:400,message:'יש כבר 20 מפתחות גישה למשפחה.'};
    var credential=TikoPasskeys.verifyPasskeyRegistration(request.credential,challenge,rpId,origin,now,passkeyHash_);
    if(auth.credentials.some(function(c){return c.id===credential.id;}))throw {status:400,message:'מפתח הגישה כבר רשום.'};
    auth.credentials.push(credential);return {registered:true};
   }
   var credential=auth.credentials.find(function(c){return c.id===request.credential?.id;});
   if(!credential)throw {status:401,message:'מפתח הגישה אינו רשום או שבוטל. השתמשו בקוד המשפחתי.'};
   TikoPasskeys.verifyPasskeyAuthentication(request.credential,challenge,credential,rpId,origin,now,passkeyHash_);
   return issuePasskeySession_(auth,credential.id,request.remember===true,request.label,now);
  });
  return {status:200,body:result};
 }catch(error){return {status:error.status||400,body:{detail:error.status?String(error.message):'לא ניתן לאמת את מפתח הגישה. נסו שוב או השתמשו בקוד המשפחתי.'}};}
}
