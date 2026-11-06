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
  generationConfig:{responseMimeType:'application/json',responseJsonSchema:shoppingScanSchema,maxOutputTokens:6000,thinkingConfig:{thinkingBudget:0}},
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
