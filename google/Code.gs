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
function authorize_(code){var expected=PropertiesService.getScriptProperties().getProperty('TIKO_FAMILY_CODE');if(expected){if(String(code||'')!==expected)throw Error('קוד הכניסה אינו נכון.');return;}var active=Session.getActiveUser().getEmail(),owner=Session.getEffectiveUser().getEmail();if(!active||active!==owner)throw Error('הכניסה לגרסה הישנה זמינה לבעלת הפרויקט בלבד.');}
function getClientConfig(){return {requiresCode:!!PropertiesService.getScriptProperties().getProperty('TIKO_FAMILY_CODE')};}
function archiveCompletedWeekly_(){return locked_(function(){var record=loadRecord_(context_());if(JSON.stringify(record.state)!==record.before)save_(record.state,record.file);return {ready:true};});}
function doGet(e){
 if(e&&e.parameter&&e.parameter.pagesBridge==='1'){
  var parent=e.parameter.parentOrigin,nonce=e.parameter.nonce;
  var allowed=PropertiesService.getScriptProperties().getProperty('TIKO_PAGES_ORIGIN')||'https://noatiko-sketch.github.io';
  if(parent!==allowed||!/^https:\/\/[a-z0-9.-]+$/.test(parent)||!/^[a-f0-9-]{36}$/.test(nonce||''))return HtmlService.createHtmlOutput('Invalid bridge origin.');
  var bridge=HtmlService.createTemplateFromFile('Bridge');
  bridge.bridgeConfig=JSON.stringify({parentOrigin:parent,nonce:nonce,requiresCode:getClientConfig().requiresCode}).replace(/</g,'\\u003c');
  return bridge.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
 }
 var template=HtmlService.createTemplateFromFile('Index');var blob=DriveApp.getFileById(TIKO.illustration).getBlob();template.illustrationSrc='data:image/png;base64,'+Utilities.base64Encode(blob.getBytes());return template.evaluate().setTitle('אוכל לשבת — משפחת טיקו').addMetaTag('viewport','width=device-width, initial-scale=1');
}
// Public HTML-service entrypoint. The server bridge token is never sent to Pages.
function pagesRequest(request,code){
 try{authorize_(code);}catch(error){return {status:401,body:{detail:'קוד הכניסה אינו נכון או שהחשבון אינו מורשה.'}};}
 try{
  if(!request||typeof request!=='object')throw {status:400,message:'בקשה לא תקינה.'};
  if(request.resource==='connect')return {status:200,body:{connected:true}};
  if(!['אמא','אבא','נעה','אביגיל','יפעת'].includes(request.actor))throw {status:401,message:'יש לבחור פרופיל.'};
  if(!['GET','POST'].includes(request.method))throw {status:400,message:'פעולה לא מוכרת.'};
  var action=request.method==='GET'?{}:request.action;
  if(!action||typeof action!=='object'||Array.isArray(action))throw {status:400,message:'פעולה לא מוכרת.'};
  action=Object.assign({},action,{actor:request.actor,compact:true});
  if(request.resource==='shopping'){
   if(request.method==='GET')action.type='shopping_snapshot';
   if(!['shopping_snapshot','shopping_add','shopping_toggle','shopping_remove','shopping_clear_bought','shopping_recategorize','shopping_import'].includes(action.type))throw {status:400,message:'פעולת קניות לא מוכרת.'};
   return {status:200,body:shoppingRequest_(action)};
  }
  if(request.resource!=='menu')throw {status:400,message:'פעולה לא מוכרת.'};
  if(request.method==='GET')return {status:200,body:readSnapshot_({actor:request.actor,saturday:request.saturday,viewed:!!request.viewed,compact:true})};
  if(typeof action.type!=='string'||action.type.startsWith('shopping_'))throw {status:400,message:'פעולה לא מוכרת.'};
  return {status:200,body:runAction(action,code)};
 }catch(error){return {status:error.status||503,body:{detail:String(error.message||error)}};}
}
function getMenu(day,code){authorize_(code);return readSnapshot_({saturday:day});}
function runAction(action,code){authorize_(code);return locked_(function(){var ctx=context_(),record=loadRecord_(ctx),result=TikoDrive.driveAction(record.state,action,action.actor||'משפחה',ctx);if(result.changed!==false||JSON.stringify(record.state)!==record.before)save_(result.state,record.file);return result.response;});}
function reply_(body){return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);}
// Shopping shares the existing file but never initializes or generates meal menus.
function shoppingRequest_(body){
 if(!['אמא','אבא','נעה','אביגיל','יפעת'].includes(body.actor))throw {status:401,message:'יש לבחור פרופיל.'};
 function read(){var file=DriveApp.getFileById(TIKO.state);return {file:file,state:JSON.parse(file.getBlob().getDataAsString('UTF-8'))};}
 if(body.type==='shopping_snapshot')return TikoDrive.shoppingSnapshot(read().state);
 return locked_(function(){var record=read(),now=new Date().toISOString(),result=body.type==='shopping_scan_reserve'?TikoDrive.reserveShoppingScan(record.state,body.mutationId,body.actor,now):TikoDrive.shoppingAction(record.state,body,body.actor,now);if(result.changed)save_(result.state,record.file);return result.response;});
}
function doPost(e){try{var b=JSON.parse(e.postData.contents||'{}'),token=PropertiesService.getScriptProperties().getProperty('TIKO_BRIDGE_TOKEN');if(!token||token.length<32||b.token!==token)return reply_({http_status:401,detail:'Unauthorized'});if(typeof b.type==='string'&&b.type.startsWith('shopping_'))return reply_(shoppingRequest_(b));if(b.type==='snapshot')return reply_(readSnapshot_(b));return reply_(locked_(function(){var ctx=context_(),record=loadRecord_(ctx),result=TikoDrive.driveAction(record.state,b,b.actor,ctx);if(result.changed!==false||JSON.stringify(record.state)!==record.before)save_(result.state,record.file);return result.response;}));}catch(error){return reply_({http_status:error.status||503,detail:String(error.message||error)});}}
// Run as owner once after the Site enters migration mode. Idempotent; Drive wins conflicts.
function setupDriveBridge(){var active=Session.getActiveUser().getEmail(),owner=Session.getEffectiveUser().getEmail();if(!active||active!==owner)throw Error('יש להריץ מתוך העורך בחשבון בעלת הפרויקט.');return locked_(function(){var token=PropertiesService.getScriptProperties().getProperty('TIKO_BRIDGE_TOKEN');if(!token||token.length<32)throw Error('חסר TIKO_BRIDGE_TOKEN בהגדרות הפרויקט.');var ctx=context_(),s=load_(ctx);if(!s.site_migration_v2){var response=UrlFetchApp.fetch('https://tiko-shabbat-menu.noatiko.chatgpt.site/api/drive-migration',{method:'post',contentType:'application/json',headers:{'x-tiko-bridge-token':token},payload:'{}',muteHttpExceptions:true});if(response.getResponseCode()!==200)throw Error('העברת הנתונים נעצרה: '+response.getResponseCode());var data=JSON.parse(response.getContentText());DriveApp.getFileById(TIKO.state).makeCopy('state-backup-before-shared-drive-'+ctx.now.replace(/[:.]/g,'-')+'.json',DriveApp.getFolderById(TIKO.folder));s=TikoDrive.mergeSiteExport(s,data,ctx);save_(s);}console.log(JSON.stringify({ready:true,storage:'google-drive',state_id:TIKO.state,migration:s.site_migration_v2,menus:Object.keys(s.menu_drafts).length,dishes:s.dish_catalog.length}));return {ready:true};});}

var TikoDrive=(function(){
// Shared with Apps Script: no browser/Node URL API required.
function recipeUrl(value) {
    if (value === undefined || value === null || value === '')
        return '';
    if (typeof value !== 'string')
        throw Error('יש להזין קישור תקין למתכון.');
    const url = value.trim();
    if (!url)
        return '';
    if (url.length > 2048 || !/^https?:\/\/[^\s/@:?#\\<>]+(?::\d{1,5})?(?:[/?#][^\s\\<>]*)?$/i.test(url))
        throw Error('יש להזין קישור למתכון שמתחיל ב־https:// או http://.');
    return url;
}
const family = ['אמא', 'אבא', 'נעה', 'אביגיל', 'יפעת'];
const defaultCategories = { salad: 'סלט', baked: 'ירקות אפויים', soup: 'מרק', pasta: 'פסטה / רביולי / ניוקי / לזניה', pastry: 'פשטידה / מאפה / קיש', main: 'מנה עיקרית', side: 'תוספת', dip: 'מטבלים ורטבים', extra: 'מנות נוספות', dessert: 'מנה אחרונה' };
function inferCategory(name) {
    if (/עוג|גליד|טפיוק|פבלוב|סלט פירות|^פירות$/.test(name))
        return 'dessert';
    if (/סלט|קולסלואו/.test(name))
        return 'salad';
    if (/מרק|גספאצ/.test(name))
        return 'soup';
    if (/פסטה|רביולי|ניוקי|לזני/.test(name))
        return 'pasta';
    if (/פשטיד|מאפה|קיש |בורקס|גחנון|צ.וקור|טוסט|פוקצ/.test(name))
        return 'pastry';
    if (/טחינה|חומוס|ציזיקי|רוטב|ממרח/.test(name) && !/דג|סלמון|בשר|קציצ/.test(name))
        return 'dip';
    if (/כרובית|כרוב|דלעת|אנטיפסטי|ירקות אפויים/.test(name) && /אפוי|בתנור|צלוי|אנטיפסטי/.test(name))
        return 'baked';
    if (/אורז|בורגול|קוסקוס|פירה|צ.יפס|תפו|תפוחי אדמה|שעועית ירוקה|ברוקולי|במיה/.test(name) && !/עוף|בשר|דג/.test(name))
        return 'side';
    if (/דג|סלמון|לברק|סול|חריימה|סביצ|לביב|קציצ|עוף|פרגית|פרגיות|שניצל|בשר|קבב|חמין|ממולא|פוקי|ספרינג|פאד תאי|קאר|נקניק/.test(name))
        return 'main';
    return 'extra';
}
function inferDiet(name) {
    const text = name.replace(/ללא (?:בשר|עוף|חלב|גבינה|גבינות|שמנת)|בלי (?:בשר|עוף|חלב|גבינה|גבינות|שמנת)|חלב (?:קוקוס|שקדים|סויה|שיבולת שועל)|שמנת צמחית/g, '');
    const vegetarian = /צמחוני|טבעוני/.test(text) && !/לא צמחוני/.test(text);
    const meat = /בשר|עוף|פרגי|שניצלים|חמין|בולונז|קבב|בקר|הודו|טלה|נקניק|פסטרמה/.test(text) && !vegetarian && !/שניצלוני תירס|נקניקיות ופתיתים/.test(text);
    const dairy = (/^(עוגה|גלידה|פבלובה|עוגת יומולדת)$/.test(text) || /גבינ|שמנת|חלומי|בוראטה|לאבנה|חמא[הת]|בולגרית|רוזה|ציזיקי|חלבי|חלב|פרמזן|מוצרלה|פטה|יוגורט|ריקוטה/.test(text)) && !/טבעוני|פרווה/.test(text);
    return meat && dairy ? 'mixed' : meat ? 'meat' : dairy ? 'dairy' : 'pareve';
}
function mealAllows(diet, meal, week) { if (diet === 'mixed')
    return false; return meal === 'friday' ? diet !== 'meat' : week === 3 ? diet !== 'dairy' : diet !== 'meat'; }
const avatarPaths = { 'אמא': 'zucchini', 'אביגיל': 'avocado', 'יפעת': 'pomegranate', 'נעה': 'broccoli', 'אבא': 'potato' };
function genderText(text, name) { if (name !== 'אבא')
    return text; const pairs = { 'שומרת': 'שומר', 'שמרי': 'שמור', 'הוסיפי': 'הוסף', 'החליפי': 'החלף', 'כתבי': 'כתוב', 'בחרי': 'בחר', 'אשרי': 'אשר', 'בדקי': 'בדוק', 'רענני': 'רענן', 'נסי': 'נסה', 'תרצי': 'תרצה', 'אישרת את התפריט': 'אישרת את התפריט' }; return text.replace(/שומרת|שמרי|הוסיפי|החליפי|כתבי|בחרי|אשרי|בדקי|רענני|נסי|תרצי/g, w => pairs[w] || w); }
const categories = { friday: ['soup', 'salad', 'salad', 'baked', 'pasta', 'pastry', 'dessert'], lunch: ['salad', 'salad', 'baked', 'main', 'side', 'dessert'] };
function addDays(day, amount) {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + amount);
    return d.toISOString().slice(0, 10);
}
function upcomingSaturday(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const part = (type) => parts.find(p => p.type === type).value;
    const day = `${part('year')}-${part('month')}-${part('day')}`;
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    // Keep this Saturday's menu through lunch, switching at 18:00 Israel time.
    if (weekday === 6 && Number(part('hour')) < 18)
        return day;
    return addDays(day, (6 - weekday + 7) % 7 || 7);
}
function validSaturday(day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
        return false;
    const parsed = new Date(`${day}T12:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day && parsed.getUTCDay() === 6 && day >= '2000-01-01';
}
function emptyMenu(saturday, anchor, anchorWeek) {
    const delta = Math.round((new Date(`${saturday}T12:00:00Z`).getTime() - new Date(`${anchor}T12:00:00Z`).getTime()) / 604800000);
    const week = (((delta + anchorWeek - 1) % 3 + 3) % 3 + 1);
    return { saturday, week, friday: { date: addDays(saturday, -1), dishes: [] }, lunch: { date: saturday, dishes: [] } };
}
function editMenu(source, action) {
    const menu = structuredClone(source);
    if (action.type === 'approve') {
        if (![...menu.friday.dishes, ...menu.lunch.dishes].some(Boolean) || [...menu.friday.dishes, ...menu.lunch.dishes].some(x => !x))
            throw Error('יש להשלים את המנות לפני האישור.');
        menu.approved = true;
        menu.approved_at = new Date().toISOString();
        return menu;
    }
    if (action.meal !== 'friday' && action.meal !== 'lunch')
        throw Error('ארוחה לא תקינה.');
    const meal = menu[action.meal];
    if (action.type === 'assign') {
        const index = action.index;
        if (!Number.isInteger(index) || index === undefined || index < 0 || !meal.dishes[index])
            throw Error('מיקום מנה לא תקין.');
        if (action.responsible !== '' && !family.includes(action.responsible))
            throw Error('יש לבחור בן משפחה.');
        if (action.responsible)
            meal.dishes[index].prepared_by = action.responsible;
        else
            delete meal.dishes[index].prepared_by;
        menu.approved = false;
        delete menu.approved_at;
        return menu;
    }
    if (action.type === 'move') {
        const from = action.index, to = action.toIndex;
        if (!Number.isInteger(from) || !Number.isInteger(to) || from === undefined || to === undefined || from < 0 || to < 0 || from >= meal.dishes.length || to >= meal.dishes.length || from === to)
            throw Error('מיקום מנה לא תקין.');
        meal.slot_categories || (meal.slot_categories = meal.dishes.map(d => d?.category || 'extra'));
        const [dish] = meal.dishes.splice(from, 1), [category] = meal.slot_categories.splice(from, 1);
        meal.dishes.splice(to, 0, dish);
        meal.slot_categories.splice(to, 0, category);
        meal.manual_order = true;
        menu.approved = false;
        delete menu.approved_at;
        return menu;
    }
    const index = action.type === 'add' ? meal.dishes.length : action.index;
    if (!Number.isInteger(index) || index === undefined || index < 0 || index >= meal.dishes.length + (action.type === 'add' ? 1 : 0))
        throw Error('מיקום מנה לא תקין.');
    if (action.type === 'add' && meal.dishes.length >= 20)
        throw Error('אפשר להוסיף עד 20 מנות לארוחה.');
    meal.slot_categories || (meal.slot_categories = meal.dishes.map((d, i) => d?.category || categories[action.meal][i] || 'extra'));
    if (action.type === 'remove') {
        if (!meal.dishes[index])
            throw Error('המנה כבר הוסרה.');
        meal.dishes.splice(index, 1);
        meal.slot_categories.splice(index, 1);
    }
    else if (action.type === 'add' || action.type === 'replace') {
        const name = String(action.dish?.name || '').trim();
        if (!name || name.length > 100)
            throw Error('כתבי שם מנה עד 100 תווים.');
        const category = action.dish?.category && action.dish.category !== 'auto' ? action.dish.category : inferCategory(name);
        const dish = { name, category, updated_by: action.actor, updated_at: new Date().toISOString() };
        if (action.dish?.recipe_url !== undefined)
            dish.recipe_url = recipeUrl(action.dish.recipe_url);
        else if (action.type === 'replace' && meal.dishes[index]?.name === name && meal.dishes[index]?.recipe_url)
            dish.recipe_url = meal.dishes[index].recipe_url;
        if (action.responsible !== undefined) {
            if (action.responsible !== '' && !family.includes(action.responsible))
                throw Error('יש לבחור בן משפחה.');
            if (action.responsible)
                dish.prepared_by = action.responsible;
        }
        if (action.type === 'add') {
            let target = meal.dishes.length;
            if (!meal.manual_order && category !== 'dessert') {
                const dessert = meal.dishes.findIndex(d => d?.category === 'dessert');
                if (dessert >= 0)
                    target = dessert;
                if (action.meal === 'friday' && category === 'soup')
                    target = 0;
            }
            meal.dishes.splice(target, 0, dish);
            meal.slot_categories.splice(target, 0, category);
        }
        else {
            if (action.responsible === undefined && meal.dishes[index]?.prepared_by)
                dish.prepared_by = meal.dishes[index].prepared_by;
            meal.dishes[index] = dish;
            meal.slot_categories[index] = category;
        }
    }
    else
        throw Error('פעולה לא מוכרת.');
    menu.approved = false;
    delete menu.approved_at;
    return menu;
}
const driveStateId = '1wc9VbyXuLl9QTWVPLUYiU1vUQjz1vmZI';
const copy = (x) => JSON.parse(JSON.stringify(x));
const norm = (name) => name.normalize('NFKC').replace(/\([^)]*\)/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
const variant = (name) => norm(name).split(' ').slice(0, 2).join(' ');
class DriveError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}
const check = (condition, message, status = 400) => { if (!condition)
    throw new DriveError(message, status); };
function initializeDrive(state, foods, ctx) {
    var _a;
    check(state.anchor_saturday === '2026-09-26' && state.anchor_week === 1 && Array.isArray(state.history) && Array.isArray(state.deliveries), 'מבנה המאגר אינו תקין.', 503);
    state.menu_drafts || (state.menu_drafts = {});
    state.menu_revisions || (state.menu_revisions = {});
    state.excluded_dishes || (state.excluded_dishes = []);
    state.custom_dishes || (state.custom_dishes = []);
    state.manual_dishes || (state.manual_dishes = []);
    state.food_categories || (state.food_categories = { ...defaultCategories });
    state.family_status || (state.family_status = {});
    if (!state.dish_catalog) {
        const all = foods.split('\n').filter(line => line.startsWith('- ')).map(line => ({ name: line.slice(2).split(' (')[0].trim(), category: 'auto' }));
        all.push(...state.manual_dishes, ...state.custom_dishes, ...Object.values(state.menu_drafts).flatMap((m) => [...m.friday.dishes, ...m.lunch.dishes].filter(Boolean)));
        const excluded = new Set(state.excluded_dishes.map(norm)), seen = new Set();
        state.dish_catalog = [];
        for (const d of all) {
            if (!d?.name || excluded.has(norm(d.name)) || seen.has(norm(d.name)))
                continue;
            seen.add(norm(d.name));
            const category = d.category && d.category !== 'auto' && d.category !== 'extra' ? d.category : inferCategory(d.name);
            state.dish_catalog.push({ ...d, category: state.food_categories[category] ? category : 'extra', diet: inferDiet(d.name), updated_by: d.updated_by || '', updated_at: d.updated_at || '' });
        }
    }
    const known = new Set(state.dish_catalog.map((d) => norm(d.name))), excluded = new Set(state.excluded_dishes.map(norm));
    for (const dish of [...state.custom_dishes, ...state.manual_dishes]) {
        if (dish?.name && !known.has(norm(dish.name)) && !excluded.has(norm(dish.name))) {
            const category = state.food_categories[dish.category] ? dish.category : inferCategory(dish.name);
            state.dish_catalog.push({ ...dish, category: state.food_categories[category] ? category : 'extra', diet: inferDiet(dish.name) });
            known.add(norm(dish.name));
        }
    }
    if (!state.dessert_seeded) {
        (_a = state.food_categories).dessert || (_a.dessert = 'מנה אחרונה');
        for (const name of ['עוגה', 'גלידה', 'טפיוקה', 'סלט פירות', 'פירות', 'פבלובה', 'עוגת יומולדת'])
            if (!state.dish_catalog.some((d) => norm(d.name) === norm(name)) && !state.excluded_dishes.some((n) => norm(n) === norm(name)))
                state.dish_catalog.push({ name, category: 'dessert', diet: inferDiet(name), updated_by: '', updated_at: '' });
        state.dessert_seeded = true;
    }
    return state;
}
const saved = (s, day) => s.menu_drafts[day] || s.history.find((m) => m.saturday === day);
const revision = (s, day) => Number(s.menu_revisions[day] || 0);
function catalog(s) { const blocked = new Set(s.excluded_dishes.map(norm)); return s.dish_catalog.filter((d) => !blocked.has(norm(d.name))).map((d) => ({ ...d, category: s.food_categories[d.category] ? d.category : 'extra', diet: inferDiet(d.name) })).sort((a, b) => a.name.localeCompare(b.name, 'he')); }
function resolve(s, dish) { const name = String(dish?.name || '').trim(); check(name && name.length <= 100, 'יש לכתוב שם מנה עד 100 תווים.'); const id = dish.category && dish.category !== 'auto' ? dish.category : inferCategory(name); const existing = s.dish_catalog.find((d) => norm(d.name) === norm(name)); const link = dish.recipe_url !== undefined ? recipeUrl(dish.recipe_url) : existing?.recipe_url; return { name, category: s.food_categories[id] ? id : 'extra', ...(link !== undefined ? { recipe_url: link } : {}) }; }
function putDish(s, dish, actor, now) { const row = { ...dish, diet: inferDiet(dish.name), updated_by: actor, updated_at: now }; s.dish_catalog = s.dish_catalog.filter((d) => norm(d.name) !== norm(row.name)); s.dish_catalog.push(row); s.excluded_dishes = s.excluded_dishes.filter((n) => norm(n) !== norm(row.name)); s.manual_dishes = s.manual_dishes.filter((d) => norm(d.name) !== norm(row.name)); s.manual_dishes.push(copy(row)); return row; }
// Keep the one recipe per catalog dish in open menus, preserving closed Saturdays.
function syncRecipe(s, dish, ctx, except) {
    if (dish.recipe_url === undefined)
        return;
    for (const [day, menu] of Object.entries(s.menu_drafts)) {
        if (day < ctx.upcoming || day === except || s.shabbat_archive?.[day])
            continue;
        let changed = false;
        for (const d of [...menu.friday.dishes, ...menu.lunch.dishes])
            if (d && norm(d.name) === norm(dish.name) && (d.recipe_url || '') !== dish.recipe_url) {
                d.recipe_url = dish.recipe_url;
                changed = true;
            }
        if (changed) {
            s.menu_revisions[day] = revision(s, day) + 1;
            menu.approved = false;
            delete menu.approved_at;
        }
    }
}
function removeDish(s, name) { s.dish_catalog = s.dish_catalog.filter((d) => norm(d.name) !== norm(name)); s.custom_dishes = s.custom_dishes.filter((d) => norm(d.name) !== norm(name)); s.manual_dishes = s.manual_dishes.filter((d) => norm(d.name) !== norm(name)); if (!s.excluded_dishes.some((n) => norm(n) === norm(name)))
    s.excluded_dishes.push(name); }
function approveHistory(s, menu) { s.history = s.history.filter((m) => m.saturday !== menu.saturday); s.history.push(copy(menu)); s.history.sort((a, b) => b.saturday.localeCompare(a.saturday)); }
function generateDriveMenu(s, day, ctx, random = Math.random) {
    const menu = emptyMenu(day, s.anchor_saturday, s.anchor_week), foods = catalog(s), used = new Set();
    const recent = new Set(s.history.filter((m) => m.saturday < day).sort((a, b) => b.saturday.localeCompare(a.saturday)).slice(0, 2).flatMap((m) => [...m.friday.dishes, ...m.lunch.dishes].filter(Boolean).map(d => variant(d.name))));
    for (const kind of ['friday', 'lunch']) {
        menu[kind].dishes = categories[kind].map(category => { const available = foods.filter((d) => mealAllows(d.diet, kind, menu.week) && !used.has(norm(d.name))); const matches = available.filter((d) => d.category === category || (category === 'main' && (d.category === 'extra' || !defaultCategories[d.category]))); const fresh = matches.filter((d) => !recent.has(variant(d.name))); const fallback = category === 'dessert' ? [] : available.filter((d) => d.category !== 'dessert'); const freshFallback = fallback.filter((d) => !recent.has(variant(d.name))); const choices = fresh.length ? fresh : matches.length ? matches : freshFallback.length ? freshFallback : fallback; const dish = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]; if (!dish)
            return null; used.add(norm(dish.name)); return { name: dish.name, category: dish.category, updated_by: 'אוטומטית', updated_at: ctx.now, ...(dish.recipe_url !== undefined ? { recipe_url: dish.recipe_url } : {}) }; });
        menu[kind].slot_categories = menu[kind].dishes.map((d, i) => d?.category || categories[kind][i]);
    }
    menu.approved = false;
    menu.layout_version = 2;
    return menu;
}
function driveSnapshot(s, day, ctx, autoGenerate = true, compact = false) {
    check(validSaturday(day), 'תאריך שבת לא תקין.');
    let menu = saved(s, day);
    if (!menu && day === ctx.upcoming && autoGenerate) {
        menu = generateDriveMenu(s, day, ctx);
        s.menu_drafts[day] = menu;
        s.menu_revisions[day] = revision(s, day) + 1;
    }
    const current = menu || emptyMenu(day, s.anchor_saturday, s.anchor_week), foods = catalog(s), candidates = {}, candidateGroups = {};
    if (!compact)
        for (const kind of ['friday', 'lunch'])
            current[kind].dishes.forEach((dish, i) => { const category = dish?.category || current[kind].slot_categories?.[i] || 'extra'; const key = kind + ':' + category; candidates[`${kind}:${i}`] = candidateGroups[key] || (candidateGroups[key] = foods.filter((d) => d.category === category && mealAllows(d.diet, kind, current.week))); });
    return { api_version: 10, storage: 'google-drive', state_id: driveStateId, status: 'ready', current: copy(current), previous: compact ? undefined : copy(s.history.filter((m) => m.saturday < day).sort((a, b) => b.saturday.localeCompare(a.saturday))[0] || null), revision: revision(s, day), catalog_revision: Number(s.catalog_revision || 0), has_menu: !!menu, upcoming_saturday: ctx.upcoming, catalog: foods, categories: copy(s.food_categories), candidates, archived_saturdays: Object.keys(s.shabbat_archive || {}).sort(), family_status: day === ctx.upcoming ? Object.values(s.family_status).filter((x) => x.saturday === day) : [] };
}
function archiveCompletedShabbats(s, ctx) {
    const today = ctx.today || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ctx.now));
    const menus = new Map();
    for (const menu of s.history)
        menus.set(menu.saturday, menu);
    for (const menu of Object.values(s.menu_drafts))
        menus.set(menu.saturday, menu);
    let count = 0;
    for (const [day, menu] of menus) {
        if (day >= today || s.shabbat_archive?.[day] || !validSaturday(day))
            continue;
        s.shabbat_archive || (s.shabbat_archive = {});
        s.shabbat_archive[day] = { saturday: day, closed_at: ctx.now, revision: revision(s, day), menu: copy(menu), family_status: copy(Object.values(s.family_status).filter((x) => x.saturday === day)), categories: copy(s.food_categories) };
        count++;
    }
    return count;
}
function markDriveSeen(s, actor, day, ctx) {
    check(family.includes(actor), 'יש לבחור פרופיל.', 401);
    if (day !== ctx.upcoming)
        return false;
    const old = s.family_status[actor], same = old?.saturday === day, rev = revision(s, day);
    if (same && old.seen_revision === rev)
        return false;
    s.family_status[actor] = { ...old, name: actor, saturday: day, seen_revision: rev, seen_at: ctx.now, approved_revision: same ? old.approved_revision : -1, approved_at: same ? old.approved_at : '' };
    return true;
}
// The caller holds the Apps Script document lock; errors leave the original state unchanged.
function driveAction(original, action, actor, ctx) {
    const s = copy(original), day = action.saturday === 'upcoming' ? ctx.upcoming : action.saturday;
    check(validSaturday(day), 'תאריך שבת לא תקין.');
    const a = { ...action, saturday: day, actor };
    check(family.includes(actor) || actor === 'משפחה', 'יש לבחור פרופיל.', 401);
    if (a.mutationId) {
        check(/^[a-zA-Z0-9-]{8,80}$/.test(a.mutationId), 'מזהה פעולה לא תקין.');
        const receipt = (s.recent_mutations || []).find((r) => r.id === a.mutationId);
        if (receipt) {
            check(receipt.actor === actor, 'מזהה פעולה לא תקין.', 409);
            return { state: s, changed: false, response: { detail: 'השינוי נשמר.', snapshot: driveSnapshot(s, day, ctx, false, a.compact) } };
        }
    }
    const complete = () => { if (a.viewed)
        markDriveSeen(s, actor, day, ctx); if (a.mutationId) {
        s.recent_mutations = [...(s.recent_mutations || []), { id: a.mutationId, actor }].slice(-80);
    } return { state: s, changed: true, response: { detail: a.type === 'seen' ? '' : a.type === 'family_approve' ? 'סימנת שאהבת את התפריט.' : 'השינוי נשמר.', snapshot: driveSnapshot(s, day, ctx, false, a.compact) } }; };
    const bumpCatalog = () => { s.catalog_revision = Number(s.catalog_revision || 0) + 1; };
    const allowed = ['archive_completed', 'transfer', 'assign', 'seen', 'family_unapprove', 'family_approve', 'approve', 'generate', 'move', 'add', 'replace', 'remove', 'catalog_save', 'catalog_remove', 'category_save', 'category_remove'];
    check(allowed.includes(a.type), 'פעולה לא מוכרת.');
    if (a.type === 'archive_completed') {
        const count = archiveCompletedShabbats(s, ctx);
        return { state: s, changed: count > 0, response: { detail: '', archived: count, snapshot: driveSnapshot(s, day, ctx, false, a.compact) } };
    }
    if (['catalog_save', 'catalog_remove', 'category_save', 'category_remove'].includes(a.type)) {
        check((a.catalogRevision ?? 0) === Number(s.catalog_revision || 0), 'מאגר המנות השתנה. יש לרענן לפני השמירה.', 409);
        check(a.revision === revision(s, day), 'התפריט השתנה. יש לרענן.', 409);
        if (a.type === 'catalog_save') {
            const dish = resolve(s, a.dish);
            if (a.oldName && norm(a.oldName) !== norm(dish.name)) {
                check(!s.dish_catalog.some((d) => norm(d.name) === norm(dish.name)), 'מנה בשם הזה כבר קיימת.');
                removeDish(s, a.oldName);
            }
            putDish(s, dish, actor, ctx.now);
            syncRecipe(s, dish, ctx);
        }
        if (a.type === 'catalog_remove') {
            check(typeof a.oldName === 'string' && s.dish_catalog.some((d) => norm(d.name) === norm(a.oldName)), 'המנה לא נמצאה.');
            removeDish(s, a.oldName);
        }
        if (a.type === 'category_save') {
            const id = String(a.id || '').trim(), label = String(a.label || '').trim();
            check(/^[a-z][a-z0-9_-]{0,49}$/.test(id) && label && label.length <= 70, 'קטגוריה לא תקינה.');
            s.food_categories[id] = label;
        }
        if (a.type === 'category_remove') {
            check(a.id && a.id !== 'extra' && s.food_categories[a.id], 'אי אפשר להסיר קטגוריה זו.');
            delete s.food_categories[a.id];
            for (const d of s.dish_catalog)
                if (d.category === a.id)
                    d.category = 'extra';
        }
        bumpCatalog();
        return complete();
    }
    check(a.revision === revision(s, day), 'התפריט השתנה. יש לרענן לפני השמירה.', 409);
    if ((a.type === 'add' || a.type === 'replace' || a.type === 'remove' && a.removeFromCatalog) && (a.compact || a.catalogRevision !== undefined))
        check((a.catalogRevision ?? 0) === Number(s.catalog_revision || 0), 'מאגר המנות השתנה. יש לרענן לפני השמירה.', 409);
    const current = copy(saved(s, day) || emptyMenu(day, s.anchor_saturday, s.anchor_week));
    if (a.type === 'transfer') {
        check((a.meal === 'friday' || a.meal === 'lunch') && (a.targetMeal === 'friday' || a.targetMeal === 'lunch'), 'ארוחה לא תקינה.');
        check(a.targetSaturday === day || a.targetSaturday === addDays(day, 7), 'אפשר להעביר רק לשבת הזו או לשבת הבאה.');
        check(a.targetSaturday !== day || a.targetMeal !== a.meal, 'המנה כבר בארוחה הזו.');
        check(Number.isInteger(a.index) && a.index !== undefined && a.index >= 0, 'מיקום מנה לא תקין.');
        const dish = current[a.meal].dishes[a.index];
        check(dish, 'המנה כבר הוסרה.');
        let target = a.targetSaturday === day ? current : copy(saved(s, a.targetSaturday) || generateDriveMenu(s, a.targetSaturday, ctx));
        check(mealAllows(inferDiet(dish.name), a.targetMeal, target.week), 'המנה אינה מתאימה לארוחה בשרית או חלבית.');
        check(!target[a.targetMeal].dishes.some(d => d && norm(d.name) === norm(dish.name)), 'המנה כבר מופיעה בארוחת היעד.');
        const source = editMenu(current, { ...a, type: 'remove' });
        if (a.targetSaturday === day)
            target = source;
        target = editMenu(target, { ...a, type: 'add', meal: a.targetMeal, dish: dish });
        const inserted = target[a.targetMeal].dishes.find(d => d && norm(d.name) === norm(dish.name));
        if (dish.prepared_by)
            inserted.prepared_by = dish.prepared_by;
        s.menu_drafts[day] = a.targetSaturday === day ? target : source;
        s.menu_revisions[day] = revision(s, day) + 1;
        if (a.targetSaturday !== day) {
            s.menu_drafts[a.targetSaturday] = target;
            s.menu_revisions[a.targetSaturday] = revision(s, a.targetSaturday) + 1;
        }
        return complete();
    }
    if (a.type === 'seen' || a.type === 'family_approve' || a.type === 'family_unapprove') {
        check(day === ctx.upcoming, 'צפיות ואהבות זמינות לשבת הקרובה בלבד.');
        const old = s.family_status[actor];
        const same = old?.saturday === day;
        if (a.type === 'seen' && old?.saturday === day && old.seen_revision === revision(s, day))
            return { state: s, changed: false, response: { detail: '', snapshot: driveSnapshot(s, day, ctx, false, a.compact) } };
        if (a.type === 'family_approve') {
            const approved = editMenu(current, { ...a, type: 'approve' });
            s.menu_drafts[day] = approved;
            approveHistory(s, approved);
        }
        s.family_status[actor] = { name: actor, saturday: day, seen_revision: revision(s, day), seen_at: ctx.now, approved_revision: a.type === 'family_unapprove' ? -1 : a.type === 'family_approve' ? revision(s, day) : same ? old.approved_revision : -1, approved_at: a.type === 'family_unapprove' ? '' : a.type === 'family_approve' ? ctx.now : same ? old.approved_at : '' };
    }
    else {
        let menu;
        if (a.type === 'generate') {
            check(!saved(s, day), 'כבר קיים תפריט לשבת הזאת.');
            menu = generateDriveMenu(s, day, ctx);
        }
        else {
            if (a.type === 'add' || a.type === 'replace') {
                a.dish = resolve(s, a.dish);
                check(mealAllows(inferDiet(a.dish.name), a.meal, current.week), 'המנה אינה מתאימה לארוחה בשרית או חלבית.');
            }
            menu = editMenu(current, a);
            if ((a.type === 'add' || a.type === 'replace') && a.dish?.recipe_url !== undefined)
                for (const d of [...menu.friday.dishes, ...menu.lunch.dishes])
                    if (d && norm(d.name) === norm(a.dish.name))
                        d.recipe_url = a.dish.recipe_url;
            if (a.type === 'add' || a.type === 'replace') {
                putDish(s, a.dish, actor, ctx.now);
                syncRecipe(s, a.dish, ctx, day);
                bumpCatalog();
            }
            if (a.type === 'remove' && a.removeFromCatalog) {
                const old = current[a.meal].dishes[a.index];
                if (old) {
                    removeDish(s, old.name);
                    bumpCatalog();
                }
            }
        }
        s.menu_drafts[day] = menu;
        s.menu_revisions[day] = revision(s, day) + 1;
        if (menu.approved)
            approveHistory(s, menu);
    }
    return complete();
}
function mergeSiteExport(original, exported, ctx) {
    const s = copy(original);
    if (s.site_migration_v2)
        return s;
    check(exported?.format === 'tiko-site-export-v1', 'קובץ העברה לא תקין.');
    const importedDates = new Set();
    for (const row of exported.menus || []) {
        const menu = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
        check(validSaturday(menu.saturday), 'תאריך העברה לא תקין.');
        const existing = saved(s, menu.saturday);
        if (existing) {
            const automaticDraft = menu.saturday === ctx.upcoming && !existing.approved && revision(s, menu.saturday) <= 1 && Number(row.revision) > 1 && ![...existing.friday.dishes, ...existing.lunch.dishes].filter(Boolean).some(d => d.updated_by && d.updated_by !== 'אוטומטית');
            if (!automaticDraft)
                continue;
            s.migration_conflicts || (s.migration_conflicts = []);
            s.migration_conflicts.push({ saturday: menu.saturday, drive: copy(existing), site: copy(menu), resolved: 'newer-site-edits', at: ctx.now });
        }
        s.menu_drafts[menu.saturday] = copy(menu);
        s.menu_revisions[menu.saturday] = Number(row.revision || 0);
        if (menu.approved)
            approveHistory(s, menu);
        importedDates.add(menu.saturday);
    }
    for (const row of exported.food_categories || [])
        if (row.label && !s.food_categories[row.id])
            s.food_categories[row.id] = row.label;
    const blocked = new Set(s.excluded_dishes.map(norm));
    for (const row of exported.catalog || []) {
        if (blocked.has(norm(row.name)))
            continue;
        const existing = s.dish_catalog.find((d) => norm(d.name) === norm(row.name));
        if (!existing || row.updated_at && row.updated_at > (existing.updated_at || ''))
            putDish(s, resolve(s, row), row.updated_by || 'משפחה', row.updated_at || ctx.now);
    }
    for (const row of exported.food_categories || [])
        if (row.label && !s.food_categories[row.id])
            s.food_categories[row.id] = row.label;
    for (const row of exported.excluded_dishes || [])
        removeDish(s, row.name);
    for (const row of exported.family_status || [])
        if (importedDates.has(row.saturday))
            s.family_status[row.name] = copy(row);
    s.site_migration_v1 || (s.site_migration_v1 = { at: ctx.now, imported_dates: [...importedDates] });
    s.site_migration_v2 = { at: ctx.now, imported_dates: [...importedDates] };
    return s;
}
const shoppingCategories = {
    produce: 'ירקות ופירות', cleaning: 'מוצרי ניקוי', legumes: 'קטניות', cereal: 'דגני בוקר',
    dairy: 'מוצרי חלב', fresh: 'דגים, בשר ועוף טריים', water: 'מים', frozen: 'קפואים', canned: 'שימורים', general: 'כללי',
};
class ShoppingError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}
const shoppingCheck = (ok, message, status = 400) => { if (!ok)
    throw new ShoppingError(message, status); };
const shoppingName = (name) => name.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('he');
function readShopping(state) {
    return state.shopping ? structuredClone(state.shopping) : { revision: 0, products: [], items: [], receipts: [] };
}
function shoppingSnapshot(state) {
    // Mutation receipts stay on the server; clients only need the current revision.
    return { status: 'ready', storage: 'google-drive', state_id: '1wc9VbyXuLl9QTWVPLUYiU1vUQjz1vmZI', shopping: { ...readShopping(state), receipts: [] } };
}
function editShopping(source, action, actor, now) {
    shoppingCheck(family.includes(actor), 'יש לבחור פרופיל.', 401);
    shoppingCheck(typeof action.mutationId === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(action.mutationId), 'מזהה פעולה לא תקין.');
    if (action.type === 'shopping_import') {
        shoppingCheck(Array.isArray(action.items) && action.items.length > 0 && action.items.length <= 80, 'יש לבחור בין מוצר אחד ל־80 מוצרים.');
        shoppingCheck(action.mutationId.length <= 70, 'מזהה ייבוא לא תקין.');
        let next = source;
        for (const [index, item] of action.items.entries()) {
            shoppingCheck(item && typeof item === 'object', 'מוצר לא תקין.');
            next = editShopping(next, { type: 'shopping_add', name: item.name, category: item.category, quantity: item.quantity, mutationId: action.mutationId + '-' + index }, actor, now);
        }
        next.revision = source.revision + 1;
        return next;
    }
    const s = structuredClone(source);
    if (action.type === 'shopping_add') {
        let product = s.products.find(p => p.id === action.productId);
        if (!action.productId) {
            shoppingCheck(typeof action.name === 'string', 'יש לכתוב שם מוצר.');
            const name = action.name.replace(/\s+/g, ' ').trim();
            shoppingCheck(name.length > 0 && name.length <= 100, 'יש לכתוב שם מוצר עד 100 תווים.');
            shoppingCheck(Object.prototype.hasOwnProperty.call(shoppingCategories, action.category || ''), 'יש לבחור קטגוריה.');
            product = s.products.find(p => shoppingName(p.name) === shoppingName(name));
            if (!product) {
                shoppingCheck(s.products.length < 2000, 'המאגר מכיל כבר 2,000 מוצרים.');
                product = { id: 'p-' + action.mutationId, name, category: action.category };
                s.products.push(product);
            }
        }
        shoppingCheck(product, 'המוצר אינו במאגר. יש לרענן את הרשימה.');
        shoppingCheck(action.quantity === undefined || typeof action.quantity === 'string' && action.quantity.length <= 60, 'כמות ארוכה מדי — עד 60 תווים.');
        const item = s.items.find(i => i.productId === product.id);
        const quantity = action.quantity?.trim() ?? item?.quantity ?? '';
        if (item)
            Object.assign(item, { quantity, bought: false, updated_by: actor, updated_at: now });
        else {
            shoppingCheck(s.items.length < 500, 'אפשר להוסיף עד 500 מוצרים לרשימה.');
            s.items.push({ productId: product.id, quantity, bought: false, updated_by: actor, updated_at: now });
        }
    }
    else if (action.type === 'shopping_toggle' || action.type === 'shopping_remove') {
        const item = s.items.find(i => i.productId === action.productId);
        shoppingCheck(item, 'המוצר כבר הוסר מהרשימה. יש לרענן.');
        if (action.type === 'shopping_toggle') {
            shoppingCheck(typeof action.bought === 'boolean', 'סימון קנייה לא תקין.');
            Object.assign(item, { bought: action.bought, updated_by: actor, updated_at: now });
        }
        else
            s.items = s.items.filter(i => i.productId !== action.productId);
    }
    else if (action.type === 'shopping_clear_bought')
        s.items = s.items.filter(i => !i.bought);
    else if (action.type === 'shopping_recategorize') {
        const product = s.products.find(p => p.id === action.productId);
        shoppingCheck(product, 'המוצר אינו במאגר.');
        shoppingCheck(Object.prototype.hasOwnProperty.call(shoppingCategories, action.category || ''), 'יש לבחור קטגוריה.');
        product.category = action.category;
    }
    else
        throw new ShoppingError('פעולת קניות לא מוכרת.');
    s.revision++;
    return s;
}
function shoppingAction(original, action, actor, now) {
    shoppingCheck(family.includes(actor), 'יש לבחור פרופיל.', 401);
    const current = readShopping(original), receipt = current.receipts.find(r => r.id === action.mutationId);
    if (receipt) {
        shoppingCheck(receipt.actor === actor, 'מזהה פעולה לא תקין.', 409);
        return { state: original, changed: false, response: { snapshot: shoppingSnapshot(original) } };
    }
    shoppingCheck(action.revision === current.revision, 'רשימת הקניות השתנתה אצל בן משפחה אחר. יש לנסות שוב לאחר הרענון.', 409);
    const next = editShopping(current, action, actor, now);
    next.receipts = [...next.receipts, { id: action.mutationId, actor }].slice(-80);
    const state = { ...original, shopping: next };
    return { state, changed: true, response: { snapshot: shoppingSnapshot(state) } };
}
// A bounded daily allowance in the existing locked Drive file, not an isolate-local counter.
// A failed provider call still consumes its reservation; replays cannot bypass the limit.
function reserveShoppingScan(original, mutationId, actor, now) {
    shoppingCheck(family.includes(actor), 'יש לבחור פרופיל.', 401);
    shoppingCheck(typeof mutationId === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(mutationId), 'מזהה צילום לא תקין.');
    const day = now.slice(0, 10), previous = original.shopping_scan_usage;
    const requests = previous?.day === day ? previous.requests : [];
    shoppingCheck(Array.isArray(requests), 'מונה הצילומים דורש בדיקה.', 503);
    shoppingCheck(!requests.some(r => r.id === mutationId), 'הצילום כבר נשלח לפענוח. יש להתחיל צילום חדש.', 409);
    shoppingCheck(requests.length < 30, 'הגעתם למכסת 30 הצילומים המשפחתית להיום. אפשר להוסיף מוצרים ידנית.', 429);
    const state = { ...original, shopping_scan_usage: { day, requests: [...requests, { id: mutationId, actor }] } };
    return { state, changed: true, response: { snapshot: shoppingSnapshot(state), scan_reserved: true } };
}

return {initializeDrive,driveSnapshot,driveAction,mergeSiteExport,markDriveSeen,archiveCompletedShabbats,shoppingSnapshot,shoppingAction,reserveShoppingScan};
})();
