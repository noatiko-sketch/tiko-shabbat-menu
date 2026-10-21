import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const config=env as unknown as {DB:D1Database;TIKO_BRIDGE_TOKEN?:string;TIKO_STORAGE?:string};
 const supplied=request.headers.get('x-tiko-bridge-token')||'';
 if(!config.TIKO_BRIDGE_TOKEN||config.TIKO_BRIDGE_TOKEN.length<32||supplied!==config.TIKO_BRIDGE_TOKEN)return Response.json({detail:'Unauthorized'},{status:401});
 if(config.TIKO_STORAGE!=='migrating')return Response.json({detail:'Migration export is closed'},{status:409});
 const [menus,catalog,food_categories,excluded_dishes,family_status]=await config.DB.batch([config.DB.prepare('SELECT * FROM menus'),config.DB.prepare('SELECT * FROM catalog'),config.DB.prepare("SELECT * FROM food_categories WHERE label<>''"),config.DB.prepare('SELECT * FROM excluded_dishes'),config.DB.prepare('SELECT * FROM family_status')]);
 return Response.json({format:'tiko-site-export-v1',exported_at:new Date().toISOString(),menus:menus.results,catalog:catalog.results,food_categories:food_categories.results,excluded_dishes:excluded_dishes.results,family_status:family_status.results},{headers:{'cache-control':'no-store'}});
}
