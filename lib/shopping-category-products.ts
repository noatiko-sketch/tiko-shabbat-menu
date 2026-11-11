import {shoppingName,type ShoppingCategory,type ShoppingProduct} from './shopping.ts';

// The persistent catalog includes products removed from the current shopping list.
export function shoppingCategoryProducts(products:ShoppingProduct[],category:ShoppingCategory,query=''):ShoppingProduct[]{
 const search=shoppingName(query);
 return products.filter(product=>product.category===category&&shoppingName(product.name).includes(search))
  .sort((a,b)=>a.name.localeCompare(b.name,'he'));
}
