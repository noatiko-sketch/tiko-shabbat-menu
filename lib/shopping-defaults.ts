import {shoppingName,type ShoppingCategory,type ShoppingProduct} from './shopping.ts';

const staples:[ShoppingCategory,string[]][]=[
 ['produce',['עגבניות','מלפפונים','בצל','תפוחי אדמה','גזר','פלפלים','לימון','שום','חסה','פירות']],
 ['dairy',['חלב','ביצים','גבינה לבנה','גבינה צהובה','יוגורט','חמאה']],
 ['fresh',['עוף','דגים']],
 ['legumes',['עדשים','חומוס']],
 ['general',['לחם','חלות','אורז','פסטה','קמח','סוכר','מלח','שמן זית','קפה','תה']],
 ['canned',['רסק עגבניות','טונה']],
 ['cleaning',['נייר טואלט','סבון כלים','שקיות אשפה']],
];
// The family catalog extends the starter list and overrides its remembered categories.
// This is a chooser only: no item is added to the active list without a selection.
export function defaultShoppingChoices(products:ShoppingProduct[],hiddenDefaults:string[]=[]){
 const choices=new Map<string,{name:string;category:ShoppingCategory}>();
 for(const [category,names] of staples)for(const name of names)choices.set(shoppingName(name),{name,category});
 for(const product of products)choices.set(shoppingName(product.name),{name:product.name,category:product.category});
 const hidden=new Set(hiddenDefaults.map(shoppingName));
 return [...choices.values()].filter(product=>!hidden.has(shoppingName(product.name)));

}
