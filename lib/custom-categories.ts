export const categoryLabel=(value:string)=>value.normalize('NFKC').replace(/\s+/g,' ').trim();
export const categoryKey=(value:string)=>categoryLabel(value).toLocaleLowerCase('he');
export function duplicateCategory(categories:Record<string,string>,label:string,except?:string){return Object.keys(categories).find(id=>id!==except&&categoryKey(categories[id])===categoryKey(label));}
