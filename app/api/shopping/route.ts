import {proxyDriveShopping,type DriveConfig} from '@/lib/drive-proxy';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const settings=():DriveConfig=>({TIKO_BRIDGE_URL:process.env.TIKO_BRIDGE_URL,TIKO_BRIDGE_TOKEN:process.env.TIKO_BRIDGE_TOKEN});
export async function GET(request:Request){return proxyDriveShopping(request,settings());}
export async function POST(request:Request){return proxyDriveShopping(request,settings());}
