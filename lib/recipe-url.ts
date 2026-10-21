// Shared with Apps Script: no browser/Node URL API required.
export function recipeUrl(value:unknown):string{
 if(value===undefined||value===null||value==='')return '';
 if(typeof value!=='string')throw Error('יש להזין קישור תקין למתכון.');
 const url=value.trim();
 if(!url)return '';
 if(url.length>2048||!/^https?:\/\/[^\s/@:?#\\<>]+(?::\d{1,5})?(?:[/?#][^\s\\<>]*)?$/i.test(url))throw Error('יש להזין קישור למתכון שמתחיל ב־https:// או http://.');
 return url;
}
