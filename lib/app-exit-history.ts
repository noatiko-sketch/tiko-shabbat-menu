type CloseWatcher = EventTarget & {destroy():void};
type BackWindow = Pick<Window,'history'|'addEventListener'|'removeEventListener'> & {
 navigator?: Pick<Navigator,'userAgent'|'userActivation'>;
 CloseWatcher?: new () => CloseWatcher;
};

export function protectAppBack(browser:BackWindow,onExitAttempt:()=>void,onResume:()=>void) {
 const history=browser.history;
 const atGuard=()=>history.state?.tikoExitGuard===true;
 const pushGuard=()=>history.pushState({...history.state,tikoExitGuard:true},'');
 let guarded=atGuard();
 let watcher:CloseWatcher|undefined;
 const Watcher=/Android/i.test(browser.navigator?.userAgent||'')?browser.CloseWatcher:undefined;
 const stopWatching=()=>{
  watcher?.destroy();
  watcher=undefined;
 };
 const watchBeforeInteraction=()=>{
  if(!Watcher)return;
  watcher=new Watcher();
  // The first Back can close the watcher even before the page can cancel a close request.
  watcher.addEventListener('close',()=>{
   watchBeforeInteraction();
   onExitAttempt();
  },{once:true});
 };
 watchBeforeInteraction();

 // Chromium can skip history entries inserted before the first user interaction.
 const arm=(event:Event)=>{
  if(!event.isTrusted||browser.navigator?.userActivation?.hasBeenActive===false)return;
  if(guarded){stopWatching();return;}
  try{
   if(!atGuard())pushGuard();
   guarded=true;
   stopWatching();
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
   stopWatching();
   // With no previous page, remove the guard so the next system Back can close the app.
   const hasGuard=atGuard();
   const pagesToGoBack=hasGuard?2:1;
   const hasPreviousPage=history.length>pagesToGoBack;
   if(hasPreviousPage)history.go(-pagesToGoBack);
   else if(hasGuard)history.go(-1);
   return hasPreviousPage;
  },
  dispose(){
   stopWatching();
   browser.removeEventListener('click',arm,true);
   browser.removeEventListener('keydown',arm,true);
   browser.removeEventListener('popstate',back);
  },
 };
}
