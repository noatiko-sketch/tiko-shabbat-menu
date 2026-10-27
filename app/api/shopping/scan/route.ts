import {env} from 'cloudflare:workers';
import {scanShoppingPhoto,type ShoppingVisionConfig} from '@/lib/shopping-vision';
export const dynamic='force-dynamic';
export async function POST(request:Request){return scanShoppingPhoto(request,env as unknown as ShoppingVisionConfig);}
