import {env} from 'cloudflare:workers';
import {proxyDriveShopping,type DriveConfig} from '@/lib/drive-proxy';
export const dynamic='force-dynamic';
const settings=()=>env as unknown as DriveConfig & {TIKO_STORAGE?:string};
function unavailable(){return Response.json({detail:'רשימת הקניות דורשת חיבור למאגר המשפחתי ב־Drive.'},{status:503,headers:{'cache-control':'no-store'}});}
export async function GET(request:Request){return settings().TIKO_STORAGE==='drive'?proxyDriveShopping(request,settings()):unavailable();}
export async function POST(request:Request){return settings().TIKO_STORAGE==='drive'?proxyDriveShopping(request,settings()):unavailable();}
