export const categoryIcons:Record<string,string>={salad:'/categories/salad.png',baked:'/categories/baked.png',soup:'/categories/soup-flat.webp',pasta:'/categories/pasta.png',pastry:'/categories/pastry.png',main:'/categories/main.png',side:'/categories/fries-flat.webp',dip:'/categories/dip-flat.webp',extra:'/categories/extra.png',dessert:'/categories/dessert.png'};
export const categoryIcon=(id:string)=>categoryIcons[id]||categoryIcons.extra;
export const avatarColors:Record<string,string>={'אמא':'#e4edce','אבא':'#f7dbc9','נעה':'#cfe5da','אביגיל':'#f4e7b9','יפעת':'#d7bda0'};
