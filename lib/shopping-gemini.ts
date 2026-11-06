import {maxScanImageBytes,parseShoppingScan,shoppingScanInstructions,shoppingScanSchema} from './shopping-scan.ts';

// Only the server constructs provider requests; no API key is sent to Pages.
export function geminiShoppingRequest(image:unknown){
 if(typeof image!=='string'||image.length>Math.ceil(maxScanImageBytes/3)*4+40)throw {status:413,message:'התמונה גדולה מדי. יש לבחור צילום קטן יותר.'};
 const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
 if(!match||match[2].length%4!==0)throw {status:400,message:'יש לבחור תמונת JPEG, PNG או WebP תקינה.'};
 const [,type,encoded]=match;
 const bytes=encoded.length/4*3-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0);
 if(bytes<20||bytes>maxScanImageBytes)throw {status:400,message:'גודל התמונה אינו תקין.'};
 const signature=type==='jpeg'?encoded.startsWith('/9j/'):type==='png'?encoded.startsWith('iVBORw0KGgo'):encoded.startsWith('UklGR');
 if(!signature)throw {status:400,message:'תוכן התמונה אינו תואם לסוג הקובץ.'};
 return {
  systemInstruction:{parts:[{text:shoppingScanInstructions}]},
  contents:[{role:'user',parts:[{text:'פענח את רשימת הקניות שבתמונה לבדיקה ותיקון לפני הוספה.'},{inlineData:{mimeType:'image/'+type,data:encoded}}]}],
  generationConfig:{responseMimeType:'application/json',responseJsonSchema:shoppingScanSchema,maxOutputTokens:6000,thinkingConfig:{thinkingLevel:'MINIMAL'}},
 };
}
export function geminiShoppingResult(payload:any){
 const candidate=payload?.candidates?.[0];
 if(candidate?.finishReason!=='STOP')throw {status:422,message:'הפענוח לא הושלם. נסו צילום ברור וממוקד יותר של הרשימה בלבד.'};
 try{
  const text=(candidate.content?.parts||[]).filter((p:any)=>typeof p.text==='string'&&!p.thought).map((p:any)=>p.text).join('');
  return parseShoppingScan(JSON.parse(text));
 }catch{throw {status:502,message:'התקבלה רשימה לא תקינה. נסו צילום ברור יותר.'};}
}

// Classify provider errors without returning raw provider messages, keys or project IDs.
export function geminiShoppingError(status:number,body:string){
 let error:any={};try{error=JSON.parse(body.slice(0,16000))?.error||{};}catch{}
 const reasons=Array.isArray(error.details)?error.details.map((d:any)=>typeof d?.reason==='string'?d.reason:'').join(' '):'';
 const message=typeof error.message==='string'?error.message.toLowerCase():'';
 const reply=(code:string,text:string)=>({status:status===429?429:502,message:`${text} (Gemini ${status}: ${code})`});
 if(/API_KEY_INVALID|API_KEY_EXPIRED/.test(reasons)||status===401||/api key not valid|api key expired/.test(message))return reply('KEY_INVALID','מפתח Gemini אינו תקין או שפג תוקפו. יש לבדוק את המפתח ששמור בהגדרות גוגל.');
 if(/SERVICE_DISABLED/.test(reasons))return reply('API_DISABLED','שירות Gemini API אינו מופעל בפרויקט של המפתח.');
 if(/API_KEY_SERVICE_BLOCKED|API_KEY_HTTP_REFERRER_BLOCKED|API_KEY_IP_ADDRESS_BLOCKED/.test(reasons))return reply('KEY_RESTRICTED','ההגבלות על מפתח Gemini חוסמות פנייה מתוך האפליקציה.');
 if(/reported as leaked|key was leaked/.test(message))return reply('KEY_BLOCKED','גוגל חסמה את המפתח. יש ליצור מפתח חלופי ולשמור אותו בהגדרות גוגל.');
 if(/location is not supported|country is not supported/.test(message))return reply('REGION_UNSUPPORTED','שירות Gemini אינו זמין במיקום שבו גוגל מריצה את הבקשה.');
 if(status===403)return reply('ACCESS_DENIED','גוגל דחתה את הרשאת הפענוח. יש לבדוק את הרשאות המפתח והפרויקט.');
 if(status===404)return reply('MODEL_UNAVAILABLE','מודל הפענוח אינו זמין לפרויקט הזה. נדרש עדכון בחיבור של טיקו.');
 if(status===400)return reply('REQUEST_INVALID','גוגל דחתה את מבנה בקשת הפענוח. נדרש תיקון בחיבור של טיקו.');
 if(status===429)return reply('QUOTA','מכסת הפענוח החינמית נוצלה או שיש עומס זמני. נסו שוב מאוחר יותר. אין מעבר לשירות בתשלום.');
 return reply(status>=500?'TEMPORARY':'PROVIDER_ERROR',status>=500?'תקלה זמנית בשירות Gemini. נסו שוב מאוחר יותר.':'שירות Gemini דחה את הבקשה. יש לבדוק את הגדרת החיבור.');
}
