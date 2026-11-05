// Pages serves this project below /tiko-shabbat-menu/; the old host uses /.
export function appPath(path:string){
 const base=typeof document==='undefined'?'/':document.querySelector('meta[name="tiko-base"]')?.getAttribute('content')||'/';
 return base+path.replace(/^\/+/, '');
}
