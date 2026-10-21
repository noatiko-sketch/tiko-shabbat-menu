import {env} from 'cloudflare:workers';
import {getMenu,postMenu} from '@/lib/menu-service';
import {proxyDriveMenu,type DriveConfig} from '@/lib/drive-proxy';
export const dynamic='force-dynamic';
const settings=()=>env as unknown as DriveConfig & {DB:D1Database;TIKO_STORAGE?:string};
const database=()=>{const db=settings().DB;if(!db)throw Error('המאגר אינו זמין.');return db;};
export async function GET(request:Request){return settings().TIKO_STORAGE==='drive'?proxyDriveMenu(request,settings()):getMenu(request,database());}
export async function POST(request:Request){if(settings().TIKO_STORAGE==='drive')return proxyDriveMenu(request,settings());if(settings().TIKO_STORAGE==='migrating')return Response.json({detail:'המאגר עובר לחיבור משותף ב־Drive. השמירה תחזור בעוד כמה דקות.'},{status:503});return postMenu(request,database());}
