/** One shared family database: the original private Google Drive state.json. */
var TIKO={folder:'1emAiM56y-9PlMrJQGl9tA0SkTAPBrnml',state:'1wc9VbyXuLl9QTWVPLUYiU1vUQjz1vmZI',food:'1eVmval7caUC1sHWiyrozuA0DpqyX1qoH',illustration:'1kaIgQ-arvxA-DzaB1ImVq6DUT-_NQQmY'};
function structuredClone(value){return JSON.parse(JSON.stringify(value));}
function context_(now){
 now=now||new Date();
 var local=Utilities.formatDate(now,'Asia/Jerusalem','yyyy-MM-dd');
 var hour=Number(Utilities.formatDate(now,'Asia/Jerusalem','H'));
 var d=new Date(local+'T12:00:00Z'),day=d.getUTCDay();
 var offset=day===6&&hour<18?0:((6-day+7)%7||7);
 d.setUTCDate(d.getUTCDate()+offset);
 return {today:local,upcoming:d.toISOString().slice(0,10),now:now.toISOString()};
}
function locked_(fn){var lock=LockService.getScriptLock();if(!lock.tryLock(25000))throw Error('מתבצע עדכון אחר כרגע. יש לנסות שוב.');try{return fn();}finally{lock.releaseLock();}}
// Request-local objects only: shared state is always read afresh from Drive.
function loadRecord_(ctx){var file=DriveApp.getFileById(TIKO.state),state=JSON.parse(file.getBlob().getDataAsString('UTF-8')),before=JSON.stringify(state);var food=state.dish_catalog?'':DriveApp.getFileById(TIKO.food).getBlob().getDataAsString('UTF-8');TikoDrive.initializeDrive(state,food,ctx);TikoDrive.archiveCompletedShabbats(state,ctx);return {file:file,state:state,before:before};}
function load_(ctx){return loadRecord_(ctx).state;}
function save_(s,file){(file||DriveApp.getFileById(TIKO.state)).setContent(JSON.stringify(s,null,2)+'\n');}
function readSnapshot_(body){
 var ctx=context_(),day=body.saturday==='upcoming'?ctx.upcoming:body.saturday||ctx.upcoming;
 function prepare(record){var snapshot=TikoDrive.driveSnapshot(record.state,day,ctx,true,!!body.compact);if(body.viewed){TikoDrive.markDriveSeen(record.state,body.actor,day,ctx);snapshot.family_status=day===ctx.upcoming?Object.values(record.state.family_status).filter(function(x){return x.saturday===day;}):[];}return {snapshot:snapshot,changed:JSON.stringify(record.state)!==record.before};}
 var record=loadRecord_(ctx),result=prepare(record);
 if(!result.changed)return result.snapshot;
 // Only a generation, first view of a revision, or normalization needs a write lock.
 // Re-read inside the lock: never persist the earlier unlocked snapshot.
 return locked_(function(){record=loadRecord_(ctx);result=prepare(record);if(result.changed)save_(record.state,record.file);return result.snapshot;});
}
function authorize_(code,session){if(session){authorizePasskeySession_(session);return;}var expected=PropertiesService.getScriptProperties().getProperty('TIKO_FAMILY_CODE');if(expected){if(String(code||'')!==expected)throw Error('קוד הכניסה אינו נכון.');return;}var active=Session.getActiveUser().getEmail(),owner=Session.getEffectiveUser().getEmail();if(!active||active!==owner)throw Error('הכניסה לגרסה הישנה זמינה לבעלת הפרויקט בלבד.');}
function getClientConfig(){return {requiresCode:!!PropertiesService.getScriptProperties().getProperty('TIKO_FAMILY_CODE'),passkeys:passkeysAvailable_()};}
function archiveCompletedWeekly_(){return locked_(function(){var record=loadRecord_(context_());if(JSON.stringify(record.state)!==record.before)save_(record.state,record.file);return {ready:true};});}
function doGet(e){
 if(e&&e.parameter&&e.parameter.pagesBridge==='1'){
  var parent=e.parameter.parentOrigin,nonce=e.parameter.nonce;
  var allowed=PropertiesService.getScriptProperties().getProperty('TIKO_PAGES_ORIGIN')||'https://noatiko-sketch.github.io';
  if(parent!==allowed||!/^https:\/\/[a-z0-9.-]+$/.test(parent)||!/^[a-f0-9-]{36}$/.test(nonce||''))return HtmlService.createHtmlOutput('Invalid bridge origin.');
  var bridge=HtmlService.createTemplateFromFile('Bridge');
  bridge.bridgeConfig=JSON.stringify({parentOrigin:parent,nonce:nonce,requiresCode:getClientConfig().requiresCode,passkeys:passkeysAvailable_()}).replace(/</g,'\\u003c');
  return bridge.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
 }
 var template=HtmlService.createTemplateFromFile('Index');var blob=DriveApp.getFileById(TIKO.illustration).getBlob();template.illustrationSrc='data:image/png;base64,'+Utilities.base64Encode(blob.getBytes());return template.evaluate().setTitle('אוכל לשבת — משפחת טיקו').addMetaTag('viewport','width=device-width, initial-scale=1');
}
// Public HTML-service entrypoint. The server bridge token is never sent to Pages.
function pagesRequest(request,code,session){
 if(request&&request.resource==='passkeys')return passkeysRequest_(request,code,session);
 try{authorize_(code,session);}catch(error){return {status:401,body:{detail:'קוד הכניסה אינו נכון או שהחשבון אינו מורשה.'}};}
 try{
  if(!request||typeof request!=='object')throw {status:400,message:'בקשה לא תקינה.'};
  if(request.resource==='connect')return {status:200,body:{connected:true}};
  if(!['אמא','אבא','נעה','אביגיל','יפעת'].includes(request.actor))throw {status:401,message:'יש לבחור פרופיל.'};
  if(!['GET','POST'].includes(request.method))throw {status:400,message:'פעולה לא מוכרת.'};
  var action=request.method==='GET'?{}:request.action;
  if(!action||typeof action!=='object'||Array.isArray(action))throw {status:400,message:'פעולה לא מוכרת.'};
  action=Object.assign({},action,{actor:request.actor,compact:true});
  if(request.resource==='shopping_scan'){
   if(request.method==='GET')return {status:200,body:{configured:shoppingScanConfigured_()}};
   return {status:200,body:scanShoppingPhoto_(action,request.actor)};
  }
  if(request.resource==='shopping'){
   if(request.method==='GET')action.type='shopping_snapshot';
   if(!['shopping_snapshot','shopping_add','shopping_toggle','shopping_remove','shopping_clear_bought','shopping_recategorize','shopping_import','shopping_default_save','shopping_default_remove'].includes(action.type))throw {status:400,message:'פעולת קניות לא מוכרת.'};
   return {status:200,body:shoppingRequest_(action)};
  }
  if(request.resource!=='menu')throw {status:400,message:'פעולה לא מוכרת.'};
  if(request.method==='GET')return {status:200,body:readSnapshot_({actor:request.actor,saturday:request.saturday,viewed:!!request.viewed,compact:true})};
  if(typeof action.type!=='string'||action.type.startsWith('shopping_'))throw {status:400,message:'פעולה לא מוכרת.'};
  return {status:200,body:runAction(action,code,session)};
 }catch(error){return {status:error.status||503,body:{detail:String(error.message||error)}};}
}
function getMenu(day,code){authorize_(code);return readSnapshot_({saturday:day});}
function runAction(action,code,session){authorize_(code,session);return locked_(function(){var ctx=context_(),record=loadRecord_(ctx),result=TikoDrive.driveAction(record.state,action,action.actor||'משפחה',ctx);if(result.changed!==false||JSON.stringify(record.state)!==record.before)save_(result.state,record.file);return result.response;});}
function reply_(body){return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);}
// Shopping shares the existing file but never initializes or generates meal menus.
function shoppingRequest_(body){
 if(!['אמא','אבא','נעה','אביגיל','יפעת'].includes(body.actor))throw {status:401,message:'יש לבחור פרופיל.'};
 function read(){var file=DriveApp.getFileById(TIKO.state);return {file:file,state:JSON.parse(file.getBlob().getDataAsString('UTF-8'))};}
 if(body.type==='shopping_snapshot'){
  var preview=read();
  if(!TikoDrive.clearWeeklyBought(preview.state,new Date().toISOString()))return TikoDrive.shoppingSnapshot(preview.state);
  return locked_(function(){var record=read();if(TikoDrive.clearWeeklyBought(record.state,new Date().toISOString()))save_(record.state,record.file);return TikoDrive.shoppingSnapshot(record.state);});
 }
 return locked_(function(){var record=read(),now=new Date().toISOString();if(TikoDrive.clearWeeklyBought(record.state,now))save_(record.state,record.file);var result=body.type==='shopping_scan_reserve'?TikoDrive.reserveShoppingScan(record.state,body.mutationId,body.actor,now):TikoDrive.shoppingAction(record.state,body,body.actor,now);if(result.changed)save_(result.state,record.file);return result.response;});
}
function doPost(e){try{var b=JSON.parse(e.postData.contents||'{}'),token=PropertiesService.getScriptProperties().getProperty('TIKO_BRIDGE_TOKEN');if(!token||token.length<32||b.token!==token)return reply_({http_status:401,detail:'Unauthorized'});if(typeof b.type==='string'&&b.type.startsWith('shopping_'))return reply_(shoppingRequest_(b));if(b.type==='snapshot')return reply_(readSnapshot_(b));return reply_(locked_(function(){var ctx=context_(),record=loadRecord_(ctx),result=TikoDrive.driveAction(record.state,b,b.actor,ctx);if(result.changed!==false||JSON.stringify(record.state)!==record.before)save_(result.state,record.file);return result.response;}));}catch(error){return reply_({http_status:error.status||503,detail:String(error.message||error)});}}
// Run as owner once after the Site enters migration mode. Idempotent; Drive wins conflicts.
function setupDriveBridge(){var active=Session.getActiveUser().getEmail(),owner=Session.getEffectiveUser().getEmail();if(!active||active!==owner)throw Error('יש להריץ מתוך העורך בחשבון בעלת הפרויקט.');return locked_(function(){var token=PropertiesService.getScriptProperties().getProperty('TIKO_BRIDGE_TOKEN');if(!token||token.length<32)throw Error('חסר TIKO_BRIDGE_TOKEN בהגדרות הפרויקט.');var ctx=context_(),s=load_(ctx);if(!s.site_migration_v2){var response=UrlFetchApp.fetch('https://tiko-shabbat-menu.noatiko.chatgpt.site/api/drive-migration',{method:'post',contentType:'application/json',headers:{'x-tiko-bridge-token':token},payload:'{}',muteHttpExceptions:true});if(response.getResponseCode()!==200)throw Error('העברת הנתונים נעצרה: '+response.getResponseCode());var data=JSON.parse(response.getContentText());DriveApp.getFileById(TIKO.state).makeCopy('state-backup-before-shared-drive-'+ctx.now.replace(/[:.]/g,'-')+'.json',DriveApp.getFolderById(TIKO.folder));s=TikoDrive.mergeSiteExport(s,data,ctx);save_(s);}console.log(JSON.stringify({ready:true,storage:'google-drive',state_id:TIKO.state,migration:s.site_migration_v2,menus:Object.keys(s.menu_drafts).length,dishes:s.dish_catalog.length}));return {ready:true};});}

// Private trigger target: not callable through google.script.run.
function clearWeeklyBought_(){return locked_(function(){var file=DriveApp.getFileById(TIKO.state),state=JSON.parse(file.getBlob().getDataAsString('UTF-8'));if(TikoDrive.clearWeeklyBought(state,new Date().toISOString()))save_(state,file);});}
// Run once in the Apps Script editor as the project owner after deployment.
function setupWeeklyShoppingCleanup(){
 var active=Session.getActiveUser().getEmail(),owner=Session.getEffectiveUser().getEmail();
 if(!active||active!==owner)throw Error('יש להריץ מתוך העורך בחשבון בעלת הפרויקט.');
 return locked_(function(){
  var existing=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='clearWeeklyBought_';});
  if(!existing.length)ScriptApp.newTrigger('clearWeeklyBought_').timeBased().everyMinutes(1).create();
  return {ready:true,timeZone:'Asia/Jerusalem',schedule:'Saturday 12:00'};
 });
}

// Gemini uses a separate, free-tier-only Google project. Never fall back to a paid provider.
function shoppingScanConfigured_(){var props=PropertiesService.getScriptProperties();return !!props.getProperty('GEMINI_API_KEY')&&props.getProperty('TIKO_GEMINI_FREE_ONLY')==='true';}
function scanShoppingPhoto_(action,actor){
 if(!shoppingScanConfigured_())throw {status:503,message:'פענוח התמונות עדיין לא מחובר. יש להגדיר בגוגל מפתח Gemini מפרויקט ללא חיוב ולאשר שימוש במסלול החינמי בלבד. אפשר להוסיף מוצרים ידנית בינתיים.'};
 var payload=TikoDrive.geminiShoppingRequest(action.image);
 // Reserve under the existing family file lock, then release before the network call.
 shoppingRequest_({type:'shopping_scan_reserve',actor:actor,mutationId:Utilities.getUuid()});
 var response;
 try{response=UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',{
  method:'post',contentType:'application/json',headers:{'x-goog-api-key':PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')},payload:JSON.stringify(payload),muteHttpExceptions:true
 });}catch(error){throw {status:502,message:'לא ניתן להתחבר לשירות הפענוח. נסו שוב מאוחר יותר.'};}
 var status=response.getResponseCode();
 if(status<200||status>=300)throw TikoDrive.geminiShoppingError(status,response.getContentText());
 var result;try{result=JSON.parse(response.getContentText());}catch(error){throw {status:502,message:'התקבלה תשובת פענוח לא תקינה. נסו שוב.'};}
 return TikoDrive.geminiShoppingResult(result);
}
