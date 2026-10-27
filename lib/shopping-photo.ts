import {maxScanImageBytes} from './shopping-scan.ts';

// Decode in the browser, normalize orientation, resize and strip metadata before upload.
export async function prepareShoppingPhoto(file:File):Promise<string>{
 if(!file.type.startsWith('image/'))throw Error('יש לבחור קובץ תמונה.');
 if(file.size>20*1024*1024)throw Error('התמונה גדולה מדי. יש לבחור צילום בגודל של עד 20 מגה־בייט.');
 const url=URL.createObjectURL(file);
 try{
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('לא ניתן לפתוח את התמונה. נסו לצלם שוב או לבחור תמונת JPEG.'));image.src=url;});
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>50_000_000)throw Error('בחרו צילום ברזולוציה רגילה, ממוקד ברשימה.');
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d');if(!context)throw Error('הדפדפן אינו תומך בהכנת התמונה.');
  for(const [edge,quality] of [[2560,.88],[2048,.8],[1600,.72]]){
   const scale=Math.min(1,edge/Math.max(image.naturalWidth,image.naturalHeight));
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
   const encoded=canvas.toDataURL('image/jpeg',quality);
   if(encoded.startsWith('data:image/jpeg;base64,')&&(encoded.length-23)*3/4<=maxScanImageBytes)return encoded;
  }
  throw Error('לא ניתן להקטין את התמונה מספיק. נסו צילום קרוב של הרשימה בלבד.');
 }finally{URL.revokeObjectURL(url);}
}
