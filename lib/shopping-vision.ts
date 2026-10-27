import {family} from './family.ts';
import {proxyDriveShopping,type DriveConfig} from './drive-proxy.ts';
import {maxScanImageBytes,parseShoppingScan,shoppingScanInstructions,shoppingScanSchema} from './shopping-scan.ts';

export type ShoppingVisionConfig=DriveConfig & {OPENAI_API_KEY?:string;TIKO_VISION_MODEL?:string;TIKO_STORAGE?:string};
const maxScanRequestBytes=3*1024*1024;
class ShoppingVisionError extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
const scanError=(message:string,status=400):never=>{throw new ShoppingVisionError(message,status);};
async function scanRequestBody(request:Request){
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))scanError('פורמט התמונה לא תקין.',415);
 const declared=Number(request.headers.get('content-length')||0);
 if(declared>maxScanRequestBytes)scanError('התמונה גדולה מדי. יש לבחור צילום קטן יותר.',413);
 const reader=request.body?.getReader();if(!reader)scanError('לא התקבלה תמונה.');
 const chunks:Uint8Array[]=[];let bytes=0;
 try{while(true){const {value,done}=await reader!.read();if(done)break;bytes+=value.byteLength;if(bytes>maxScanRequestBytes){await reader!.cancel();scanError('התמונה גדולה מדי. יש לבחור צילום קטן יותר.',413);}chunks.push(value);}}
 finally{reader!.releaseLock();}
 const body=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(body)) as {image?:unknown};}catch{scanError('בקשת הפענוח לא תקינה.');}
}
function validateScanImage(value:unknown):string {
 if(typeof value!=='string')scanError('לא התקבלה תמונה.');
 const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value as string);
 if(!match||match[2].length%4!==0)scanError('יש לבחור תמונת JPEG, PNG או WebP תקינה.');
 const [,type,encoded]=match!;
 const bytes=encoded.length/4*3-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0);
 if(bytes>maxScanImageBytes)scanError('התמונה גדולה מדי. יש לבחור צילום קטן יותר.',413);
 if(bytes<20)scanError('התמונה אינה תקינה.');
 let header='';try{header=atob(encoded.slice(0,32));}catch{scanError('התמונה אינה תקינה.');}
 const valid=type==='jpeg'?header.startsWith('\xff\xd8\xff'):type==='png'?header.startsWith('\x89PNG\r\n\x1a\n'):header.startsWith('RIFF')&&header.slice(8,12)==='WEBP';
 if(!valid)scanError('תוכן התמונה אינו תואם לסוג הקובץ.');return value as string;
}

export async function scanShoppingPhoto(request:Request,config:ShoppingVisionConfig,transport:typeof fetch=fetch){
 const headers={'cache-control':'no-store'};
 try{
  let actor='';try{actor=decodeURIComponent(request.headers.get('x-family-member')||'');}catch{scanError('יש לבחור פרופיל.',401);}
  if(!family.includes(actor as any))scanError('יש לבחור פרופיל.',401);
  if(request.headers.get('origin')!==new URL(request.url).origin)scanError('בקשה ממקור לא מורשה.',403);
  if(config.TIKO_STORAGE!=='drive')scanError('צילום רשימה דורש את החיבור המשפחתי ב־Drive.',503);
  if(!config.OPENAI_API_KEY)scanError('שירות פענוח התמונות עדיין לא הוגדר. אפשר להוסיף מוצרים ידנית.',503);
  const input=await scanRequestBody(request),image=validateScanImage(input?.image);
  // Reserve one paid attempt under the existing Drive lock before contacting the provider.
  const permit=await proxyDriveShopping(new Request(request.url,{method:'POST',headers:{'content-type':'application/json','origin':new URL(request.url).origin,'x-family-member':encodeURIComponent(actor)},body:JSON.stringify({type:'shopping_scan_reserve',mutationId:crypto.randomUUID()})}),config,transport);
  const permission=await permit.json() as {scan_reserved?:boolean;detail?:string};
  if(!permit.ok)scanError(permission.detail||'לא ניתן להתחיל פענוח כרגע.',permit.status);
  if(permission.scan_reserved!==true)scanError('יש לעדכן את חבילת Google כדי להפעיל צילום רשימה.',503);
  const result=await transport('https://api.openai.com/v1/responses',{
   method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+config.OPENAI_API_KEY},signal:AbortSignal.timeout(45000),
   body:JSON.stringify({model:config.TIKO_VISION_MODEL||'gpt-4.1-mini',store:false,instructions:shoppingScanInstructions,max_output_tokens:6000,
    input:[{role:'user',content:[{type:'input_text',text:'פענח את רשימת הקניות שבתמונה לבדיקה ותיקון לפני הוספה.'},{type:'input_image',image_url:image,detail:'high'}]}],
    text:{format:{type:'json_schema',name:'shopping_photo',strict:true,schema:shoppingScanSchema}},
   }),
  });
  if(!result.ok)scanError(result.status===429?'שירות הפענוח אינו זמין כרגע עקב עומס או מכסה. נסו שוב מאוחר יותר.':'לא ניתן לפענח כרגע. אפשר לנסות שוב מאוחר יותר או להוסיף מוצרים ידנית.',result.status===429?429:502);
  const payload=await result.json() as {status?:string;output?:{type:string;content?:{type:string;text?:string}[]}[]};
  const content=(payload.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]);
  if(content.some(x=>x.type==='refusal'))scanError('לא ניתן לפענח את הצילום הזה. נסו צילום ממוקד של הרשימה בלבד.',422);
  if(payload.status!=='completed')scanError('הפענוח לא הושלם. נסו לצלם חלק קצר יותר מהרשימה.',502);
  let decoded;try{decoded=JSON.parse(content.filter(x=>x.type==='output_text').map(x=>x.text||'').join(''));}catch{scanError('התקבלה תשובת פענוח לא תקינה. יש לנסות שוב.',502);}
  try{return Response.json(parseShoppingScan(decoded),{headers});}catch{scanError('התקבלה רשימה לא תקינה. נסו צילום ברור יותר.',502);}
 }catch(error){
  if(error instanceof ShoppingVisionError)return Response.json({detail:error.message},{status:error.status,headers});
  const timedOut=error instanceof Error&&['TimeoutError','AbortError'].includes(error.name);
  return Response.json({detail:timedOut?'הפענוח ארך יותר מדי. אפשר לנסות שוב או להוסיף מוצרים ידנית.':'לא ניתן להתחבר לשירות הפענוח כרגע. נסו שוב מאוחר יותר.'},{status:timedOut?504:502,headers});
 }
}
