import type {ShoppingProduct} from './shopping.ts';

// Only an explicit family choice adds membership. Legacy inferred defaults and
// starter items are intentionally cleared; the product catalog stays intact.
export function defaultShoppingChoices(products:ShoppingProduct[],defaultProductIds:string[]=[]){
 const ids=new Set(defaultProductIds);
 return products.filter(product=>ids.has(product.id)).sort((a,b)=>a.name.localeCompare(b.name,'he'));
}
