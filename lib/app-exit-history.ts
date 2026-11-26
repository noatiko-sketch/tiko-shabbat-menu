// Keep one same-document entry so the browser's Back gesture can ask before leaving.
export function protectAppBack(browser:Pick<Window,'history'|'addEventListener'|'removeEventListener'>,onExitAttempt:()=>void,onResume:()=>void) {
 const history=browser.history;
 const atGuard=()=>history.state?.tikoExitGuard===true;
 const pushGuard=()=>history.pushState({...history.state,tikoExitGuard:true},'');
 let guarded=atGuard();

 // Chromium can skip history entries inserted before the first user interaction.
 const arm=(event:Event)=>{
  if(!event.isTrusted||guarded)return;
  try{
   if(!atGuard())pushGuard();
   guarded=true;
   onResume();
  }catch{
   // Some embedded browsers restrict changes to session history.
  }
 };
 const back=()=>{
  if(atGuard()){
   guarded=true;
   return;
  }
  if(!guarded)return;
  pushGuard();
  onExitAttempt();
 };

 browser.addEventListener('click',arm,true);
 browser.addEventListener('keydown',arm,true);
 browser.addEventListener('popstate',back);
 return {
  leave(){
   guarded=false;
   // With no previous page, remove the guard so the next system Back can close the app.
   const hasPreviousPage=history.length>2;
   history.go(hasPreviousPage?-2:-1);
   return hasPreviousPage;
  },
  dispose(){
   browser.removeEventListener('click',arm,true);
   browser.removeEventListener('keydown',arm,true);
   browser.removeEventListener('popstate',back);
  },
 };
}
