import {family} from './family.ts';
import {upcomingSaturday} from './menu-model.ts';
export type DriveConfig={TIKO_BRIDGE_URL?:string;TIKO_BRIDGE_TOKEN?:string};
export async function proxyDriveMenu(request:Request,config:DriveConfig,transport:typeof fetch=fetch,resource:'menu'|'shopping'='menu'){
 const started=performance.now();
 try{
 const actor=decodeURIComponent(request.headers.get('x-family-member')||'');if(!family.includes(actor as any))return Response.json({detail:'יש לבחור פרופיל.'},{status:401});
 const origin=request.headers.get('origin');if(request.method==='POST'&&origin&&origin!==new URL(request.url).origin)return Response.json({detail:'בקשה ממקור לא מורשה.'},{status:403});
 const {TIKO_BRIDGE_URL:url,TIKO_BRIDGE_TOKEN:token}=config;
 if(!url||!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)||!token||token.length<32)throw Error('חיבור המאגר ב־Google Drive עדיין לא הושלם.');
 const action:any=request.method==='GET'?(resource==='shopping'?{type:'shopping_snapshot'}:{type:'snapshot',saturday:new URL(request.url).searchParams.get('saturday')||upcomingSaturday(),viewed:new URL(request.url).searchParams.get('viewed')==='1'}):await request.json();
 if(resource==='shopping'&&!['shopping_snapshot','shopping_add','shopping_toggle','shopping_remove','shopping_clear_bought','shopping_recategorize'].includes(action?.type))return Response.json({detail:'פעולת קניות לא מוכרת.'},{status:400,headers:{'cache-control':'no-store'}});
 const response=await transport(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...action,compact:true,actor,token}),redirect:'follow',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('המאגר ב־Google Drive אינו זמין כרגע.');let result:any;try{result=await response.json();}catch{throw Error('חיבור גוגל סקריפט דורש בדיקה.');}
 if(result.http_status)return Response.json({detail:result.detail||'הפעולה נכשלה.'},{status:result.http_status,headers:{'cache-control':'no-store','server-timing':`drive;dur=${(performance.now()-started).toFixed(1)}`}});
 const snapshot=request.method==='GET'?result:result.snapshot;if(snapshot?.storage!=='google-drive'||snapshot?.state_id!=='1wc9VbyXuLl9QTWVPLUYiU1vUQjz1vmZI'||snapshot.status!=='ready')throw Error('החיבור אינו מצביע על המאגר המשפחתי ב־Drive.');
 if(resource==='shopping'&&(!snapshot.shopping||!Array.isArray(snapshot.shopping.products)||!Array.isArray(snapshot.shopping.items)||!Number.isInteger(snapshot.shopping.revision)))throw Error('רשימת הקניות דורשת עדכון של חבילת Google Apps Script.');
 return Response.json(result,{headers:{'cache-control':'no-store','server-timing':`drive;dur=${(performance.now()-started).toFixed(1)}`}});
 }catch(error){return Response.json({status:'error',current:null,candidates:{},detail:(error as Error).message},{status:503,headers:{'cache-control':'no-store','server-timing':`drive;dur=${(performance.now()-started).toFixed(1)}`}});}
}
export function proxyDriveShopping(request:Request,config:DriveConfig,transport:typeof fetch=fetch){return proxyDriveMenu(request,config,transport,'shopping');}
