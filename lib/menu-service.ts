import {seedDesserts} from './desserts.ts';
import initial from './menu-import.json' with {type:'json'};
import { categories, editMenu, emptyMenu, upcomingSaturday, validSaturday, type Menu, type Dish, type Action } from './menu-model.ts';
import {family,inferDiet,mealAllows,defaultCategories} from './family.ts';
import {normalized,seedCatalog,catalogSnapshot,resolveDish} from './menu-store.ts';
type Row = {payload:string;revision:number};
type Legacy = {current?:Menu|null;previous?:Menu|null;candidates?:Record<string,Dish[]>};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
function actor(request:Request){const name=decodeURIComponent(request.headers.get('x-family-member')||'');if(!family.includes(name as typeof family[number]))throw Error('יש לבחור מי משתמש באתר.');return name;}
async function seed(db:D1Database,source:Legacy|null){
 const markers=(await db.prepare("SELECT id FROM food_categories WHERE id IN ('__catalog_ready_v1','__dessert_ready_v1')").all<{id:string}>()).results;if(markers.length===2)return;
 if(markers.some(r=>r.id==='__catalog_ready_v1')){await seedDesserts(db);return;}
 const menus=[...[source?.current,source?.previous].filter(Boolean),...initial.menus] as Menu[];
 if(menus.length)await db.batch(menus.map(m=>db.prepare('INSERT OR IGNORE INTO menus (saturday,payload,revision,updated_at) VALUES (?,?,0,?)').bind(m.saturday,JSON.stringify(m),new Date().toISOString())));
 await seedCatalog(db,Object.values(source?.candidates||{}).flat());await seedDesserts(db);
}
async function read(db:D1Database,saturday:string){const row=await db.prepare('SELECT payload,revision FROM menus WHERE saturday=?').bind(saturday).first<Row>();return row?{menu:JSON.parse(row.payload) as Menu,revision:row.revision,exists:true}:{menu:emptyMenu(saturday,initial.anchor,initial.anchorWeek),revision:0,exists:false};}
async function snapshot(db:D1Database,saturday:string){
 const stored=await read(db,saturday);
 const [cat,history,statusResult]=await Promise.all([
 catalogSnapshot(db),
 db.prepare("SELECT payload FROM menus WHERE saturday < ? AND json_extract(payload,'$.approved')=1 ORDER BY saturday DESC LIMIT 2").bind(saturday).all<{payload:string}>(),
 saturday===upcomingSaturday()?db.prepare('SELECT * FROM family_status WHERE saturday=?').bind(saturday).all():Promise.resolve({results:[]})
 ]);
 const recent=history.results.map(x=>JSON.parse(x.payload) as Menu).filter(x=>x.approved).slice(0,2);
 const used=new Set(recent.flatMap(m=>[...m.friday.dishes,...m.lunch.dishes].filter(Boolean).map(d=>normalized(d!.name))));
 const candidates:Record<string,Dish[]>={};
 for(const kind of ['friday','lunch'] as const)stored.menu[kind].dishes.forEach((dish,i)=>{
 const category=stored.menu[kind].slot_categories?.[i]||dish?.category||categories[kind][i]||'extra';
 candidates[`${kind}:${i}`]=cat.catalog.filter(d=>(category==='extra'||d.category===category)&&!used.has(normalized(d.name))&& mealAllows(d.diet,kind,stored.menu.week));
 });
 const status=statusResult.results;
 return {api_version:6,status:'ready',current:stored.menu,revision:stored.revision,candidates,upcoming_saturday:upcomingSaturday(),has_menu:stored.exists,...cat,family_status:status};
}
export async function generateMenu(db:D1Database,base:Menu,actorName='אוטומטית',random= Math.random):Promise<Menu>{
 const catalog=(await catalogSnapshot(db)).catalog;
 const past=(await db.prepare('SELECT payload FROM menus WHERE saturday < ? ORDER BY saturday DESC').bind(base.saturday).all<{payload:string}>()).results.map(x=>JSON.parse(x.payload) as Menu).filter(m=>m.approved).slice(0,2);
 const recent=new Set(past.flatMap(m=>[...m.friday.dishes,...m.lunch.dishes].filter(Boolean).map(d=>normalized(d!.name))));
 const selected=new Set<string>(), next=structuredClone(base),now=new Date().toISOString();
 const standard=new Set(Object.keys(defaultCategories));
 for(const kind of ['friday','lunch'] as const){next[kind].slot_categories=[...categories[kind]];next[kind].dishes=categories[kind].map(category=>{
 const available=catalog.filter(d=>mealAllows(d.diet,kind,next.week)&&!selected.has(normalized(d.name)));
 // New/custom categories can participate in the flexible main slot, and any slot when its category runs out.
 const matches=available.filter(d=>d.category===category||(category==='main'&&(d.category==='extra'||!standard.has(d.category))));
 const pool=matches.filter(d=>!recent.has(normalized(d.name)));
 const fallback=category==='dessert'?[]:available.filter(d=>d.category!=='dessert');
 const fresh=fallback.filter(d=>!recent.has(normalized(d.name)));const choices=pool.length?pool:matches.length?matches:fresh.length?fresh:fallback;
 const d=choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];if(!d)return null;
 selected.add(normalized(d.name));return {name:d.name,category:d.category,updated_by:actorName,updated_at:now};
 });next[kind].slot_categories=next[kind].dishes.map((d,i)=>d?.category||categories[kind][i]);}
 next.approved=false;next.layout_version=2;delete next.approved_at;return next;
}
export async function ensureUpcoming(db:D1Database,saturday:string){
 const stored=await read(db,saturday);if(stored.exists){
 let changed=false;
 if(stored.menu.layout_version!==2&&[...stored.menu.friday.dishes,...stored.menu.lunch.dishes].some(Boolean)){
 const cat=(await catalogSnapshot(db)).catalog,used=new Set([...stored.menu.friday.dishes,...stored.menu.lunch.dishes].filter(Boolean).map(d=>normalized(d!.name)));
 for(const kind of ['friday','lunch'] as const){
 if(!stored.menu[kind].dishes.some(d=>d?.category==='dessert')){
 const pool=cat.filter(d=>d.category==='dessert'&&mealAllows(d.diet,kind,stored.menu.week)),d=pool.find(d=>!used.has(normalized(d.name)))||pool[0];
 if(d){stored.menu[kind].dishes.push({name:d.name,category:'dessert',updated_by:'אוטומטית',updated_at:new Date().toISOString()});used.add(normalized(d.name));}
 }
 const rank=(d:Dish|null)=>d?.category==='dessert'?2:kind==='friday'&&d?.category==='soup'?0:1;
 stored.menu[kind].dishes.sort((a,b)=>rank(a)-rank(b));stored.menu[kind].slot_categories=stored.menu[kind].dishes.map(d=>d?.category||'extra');
 }stored.menu.layout_version=2;changed=true;
 }
 const mainIndex=stored.menu.lunch.dishes[3]?.category==='dip'&&stored.menu.lunch.dishes[3]?.updated_by==='אוטומטית'?3:-1;
 if(!stored.menu.approved&&!stored.menu.lunch.manual_order&&mainIndex>=0){
 const used=new Set([...stored.menu.friday.dishes,...stored.menu.lunch.dishes].filter(Boolean).map(d=>normalized(d!.name))),replacement=(await catalogSnapshot(db)).catalog.find(d=>d.category==='main'&&mealAllows(d.diet,'lunch',stored.menu.week)&&!used.has(normalized(d.name)));
 if(replacement){stored.menu.lunch.dishes[mainIndex]={name:replacement.name,category:replacement.category,updated_by:'אוטומטית',updated_at:new Date().toISOString()};stored.menu.lunch.slot_categories||=stored.menu.lunch.dishes.map(d=>d?.category||'extra');stored.menu.lunch.slot_categories[mainIndex]=replacement.category;changed=true;}
 }
 if(changed){stored.menu.approved=false;delete stored.menu.approved_at;await db.prepare('UPDATE menus SET payload=?,revision=revision+1,updated_at=? WHERE saturday=? AND revision=?').bind(JSON.stringify(stored.menu),new Date().toISOString(),saturday,stored.revision).run();}
 return;
 }
 const next=await generateMenu(db,stored.menu);
 await db.prepare('INSERT OR IGNORE INTO menus (saturday,payload,revision,updated_at) VALUES (?,?,0,?)').bind(saturday,JSON.stringify(next),new Date().toISOString()).run();
}
export async function getMenu(request:Request,db:D1Database){try{
 actor(request);const saturday=new URL(request.url).searchParams.get('saturday')||upcomingSaturday();if(!validSaturday(saturday))return json({detail:'תאריך שבת לא תקין.'},400);
 // The shared database is authoritative. Read the legacy source only for the initial import.
 await seed(db,null);
 if(saturday===upcomingSaturday())await ensureUpcoming(db,saturday);
 return json(await snapshot(db,saturday));
}catch(error){return json({status:'error',current:null,candidates:{},detail:(error as Error).message},503);}}
export async function postMenu(request:Request,db:D1Database){try{
 const name=actor(request),now=new Date().toISOString();
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({detail:'בקשה ממקור לא מורשה.'},403);
 const action=await request.json() as Action & {type:string;diet?:string;oldName?:string;id?:string;label?:string};
 if(action.saturday==='upcoming')action.saturday=upcomingSaturday();if(!validSaturday(action.saturday))return json({detail:'תאריך שבת לא תקין.'},400);
 await seed(db,null);
 const stored=await read(db,action.saturday);
 if(['seen','family_approve'].includes(action.type)){
 if(action.saturday!==upcomingSaturday())return json({detail:'צפיות ואישורים זמינים לשבת הקרובה בלבד.'},400);
 if(action.revision!==stored.revision)return json({detail:'התפריט השתנה. יש לרענן לפני האישור.'},409);
 const statusCommands:D1PreparedStatement[]=[];
 if(action.type==='family_approve'){
 editMenu(stored.menu,{...action,type:'approve'});
 statusCommands.push(db.prepare("UPDATE menus SET payload=json_set(payload,'$.approved',json('true'),'$.approved_at',?) WHERE saturday=? AND revision=?").bind(now,action.saturday,stored.revision));
 }
 statusCommands.push(db.prepare(`INSERT INTO family_status (name,saturday,seen_revision,seen_at,approved_revision,approved_at) SELECT ?,?,?,?,?,? WHERE COALESCE((SELECT revision FROM menus WHERE saturday=?),0)=? ON CONFLICT(name) DO UPDATE SET saturday=excluded.saturday,seen_revision=excluded.seen_revision,seen_at=excluded.seen_at,approved_revision=CASE WHEN ? THEN excluded.approved_revision WHEN family_status.saturday=excluded.saturday THEN family_status.approved_revision ELSE -1 END,approved_at=CASE WHEN ? THEN excluded.approved_at WHEN family_status.saturday=excluded.saturday THEN family_status.approved_at ELSE '' END`).bind(name,action.saturday,stored.revision,now,action.type==='family_approve'?stored.revision:-1,action.type==='family_approve'?now:'',action.saturday,stored.revision,action.type==='family_approve'?1:0,action.type==='family_approve'?1:0));
 const statusResults=await db.batch(statusCommands);if(statusResults[statusResults.length-1].meta.changes!==1)return json({detail:'התפריט השתנה. יש לרענן ולאשר את הגרסה העדכנית.'},409);
 return json({detail:action.type==='seen'?'':'סימנת שאהבת את התפריט.',snapshot:await snapshot(db,action.saturday)});
 }
 if(['catalog_save','catalog_remove','category_save','category_remove'].includes(action.type)){
 const commands:D1PreparedStatement[]=[];
 if(action.type==='catalog_save'){
 const d=await resolveDish(db,action.dish!);const diet=inferDiet(d.name);
 if(action.oldName&&action.oldName!==d.name){const duplicate=await db.prepare('SELECT name FROM catalog WHERE name=?').bind(d.name).first();if(duplicate)throw Error('מנה בשם הזה כבר קיימת במאגר.');commands.push(db.prepare('DELETE FROM catalog WHERE name=?').bind(action.oldName),db.prepare('INSERT OR IGNORE INTO excluded_dishes (name) VALUES (?)').bind(normalized(action.oldName)));}
 commands.push(db.prepare('INSERT INTO catalog (name,category,diet,updated_by,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET category=excluded.category,diet=excluded.diet,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(d.name,d.category,diet,name,now),db.prepare('DELETE FROM excluded_dishes WHERE name=?').bind(normalized(d.name)));
 }else if(action.type==='catalog_remove'){
 if(!action.oldName)throw Error('חסר שם מנה.');commands.push(db.prepare('DELETE FROM catalog WHERE name=?').bind(action.oldName),db.prepare('INSERT OR IGNORE INTO excluded_dishes (name) VALUES (?)').bind(normalized(action.oldName)));
 }else if(action.type==='category_save'){
 const label=String(action.label||'').trim();if(!label||label.length>70)throw Error('יש לכתוב שם קטגוריה עד 70 תווים.');const id=action.id||crypto.randomUUID();commands.push(db.prepare('INSERT INTO food_categories (id,label) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label').bind(id,label));
 }else{
 if(!action.id||action.id==='extra')throw Error('הקטגוריה ״מנות נוספות״ נשמרת כדי שכל המנות יהיו נגישות.');commands.push(db.prepare("UPDATE food_categories SET label='' WHERE id=?").bind(action.id),db.prepare("UPDATE catalog SET category='extra',updated_by=?,updated_at=? WHERE category=?").bind(name,now,action.id));
 }
 commands.push(db.prepare('INSERT INTO activity (id,saturday,actor,description,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),action.saturday,name,action.type==='catalog_remove'?`הוסרה מהמאגר: ${action.oldName}`:action.type.startsWith('category')?'עודכנו קטגוריות המאגר':`עודכנה במאגר: ${action.dish?.name}`,now));await db.batch(commands);return json({detail:'המאגר עודכן.',snapshot:await snapshot(db,action.saturday)});
 }
 if(!['generate','replace','remove','add','approve','move'].includes(action.type))return json({detail:'פעולה לא מוכרת.'},400);
 if(action.revision!==stored.revision)return json({detail:'התפריט עודכן ממקום אחר. יש לרענן לפני השמירה.'},409);
 let next:Menu;
 if(action.type==='generate'){
 if(action.saturday!==upcomingSaturday()||stored.menu.friday.dishes.length||stored.menu.lunch.dishes.length)throw Error('אפשר לבנות הצעה רק לשבת הקרובה כשאין בה תפריט.');
 next=await generateMenu(db,stored.menu,name);
 }else{if(action.dish){action.dish=await resolveDish(db,action.dish);if(action.meal&&!mealAllows(inferDiet(action.dish.name),action.meal,stored.menu.week))throw Error(action.meal==='friday'?'אי אפשר להוסיף מנה בשרית לארוחה חלבית.':'אי אפשר להוסיף מנה חלבית לארוחה בשרית.');}next=editMenu(stored.menu,{...action,actor:name});}
 const oldDish=action.meal&&action.index!==undefined?stored.menu[action.meal].dishes[action.index]:null;
 const commands=[db.prepare('INSERT OR IGNORE INTO menus (saturday,payload,revision,updated_at) VALUES (?,?,0,?)').bind(action.saturday,JSON.stringify(stored.menu),now),db.prepare('UPDATE menus SET payload=?,revision=revision+1,updated_at=? WHERE saturday=? AND revision=?').bind(JSON.stringify(next),now,action.saturday,stored.revision)];
 // Dependent writes run only for the successful compare-and-swap payload.
 const guard='EXISTS (SELECT 1 FROM menus WHERE saturday=? AND revision=? AND payload=?)';
 const guardArgs=[action.saturday,stored.revision+1,JSON.stringify(next)];
 if(action.type==='remove'&&action.removeFromCatalog&&oldDish){commands.push(db.prepare(`INSERT OR IGNORE INTO excluded_dishes (name) SELECT ? WHERE ${guard}`).bind(normalized(oldDish.name),...guardArgs),db.prepare(`DELETE FROM catalog WHERE name=? AND ${guard}`).bind(oldDish.name,...guardArgs));}
 if(action.dish){commands.push(db.prepare(`INSERT INTO catalog (name,category,diet,updated_by,updated_at) SELECT ?,?,?,?,? WHERE ${guard} ON CONFLICT(name) DO UPDATE SET category=excluded.category,diet=excluded.diet,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).bind(action.dish.name,action.dish.category,inferDiet(action.dish.name),name,now,...guardArgs),db.prepare(`DELETE FROM excluded_dishes WHERE name=? AND ${guard}`).bind(normalized(action.dish.name),...guardArgs));}
 const description=action.type==='remove'?`הוסרה מהתפריט: ${oldDish?.name}`:action.type==='move'?'עודכן סדר המנות':action.type==='generate'?'נבנתה הצעת תפריט':action.type==='approve'?'התפריט נשמר בהיסטוריה':`עודכנה מנה: ${action.dish?.name}`;
 commands.push(db.prepare(`INSERT INTO activity (id,saturday,actor,description,created_at) SELECT ?,?,?,?,? WHERE ${guard}`).bind(crypto.randomUUID(),action.saturday,name,description,now,...guardArgs));
 const results=await db.batch(commands);if(results[1].meta.changes!==1)return json({detail:'התפריט השתנה. יש לרענן ולנסות שוב.'},409);
 return json({detail:'השינוי נשמר.',snapshot:await snapshot(db,action.saturday)});
}catch(error){return json({detail:(error as Error).message||'השמירה נכשלה.'},400);}}
