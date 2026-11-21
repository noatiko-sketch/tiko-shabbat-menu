'use client';

import {createContext,useCallback,useContext,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowRight} from 'lucide-react';

type BackStep = {id: symbol; depth: number; run: () => void; disabled: boolean};
const BackContext = createContext<((step: BackStep) => () => void) | null>(null);

export function AppBackButton({onBack,disabled=false}:{onBack:()=>void;disabled?:boolean}) {
 return <button type="button" className="app-back-button" data-app-back disabled={disabled} onClick={onBack}>
  <ArrowRight size={20} aria-hidden="true"/> חזור
 </button>;
}

export function AppBackProvider({children}:{children:ReactNode}) {
 const [steps,setSteps]=useState<BackStep[]>([]);
 const register=useCallback((step:BackStep)=>{
  setSteps(previous=>[...previous,step]);
  return ()=>setSteps(previous=>previous.filter(item=>item.id!==step.id));
 },[]);
 const current=steps.reduce<BackStep|undefined>(
  (highest,step)=>!highest||step.depth>=highest.depth?step:highest,undefined);
 return <BackContext.Provider value={register}>
  {children}
  <div className="app-back-bar" dir="rtl">
   <AppBackButton disabled={!current||current.disabled} onBack={()=>current?.run()}/>
  </div>
 </BackContext.Provider>;
}

export function useAppBack(active:boolean,depth:number,run:()=>void,disabled=false) {
 const register=useContext(BackContext),latest=useRef(run);
 useLayoutEffect(()=>{latest.current=run;},[run]);
 useLayoutEffect(()=>{
  if(active&&register)return register({id:Symbol(),depth,run:()=>latest.current(),disabled});
 },[active,depth,disabled,register]);
}
