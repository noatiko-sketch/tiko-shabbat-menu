'use client';
import {createContext,useContext,useEffect,useRef,useState} from 'react';
import type {ReactNode,PointerEvent} from 'react';
import {GripVertical} from 'lucide-react';
import {reorderPreview,type RowBounds} from '@/lib/reorder-preview';
type Preview=ReturnType<typeof reorderPreview>;
type Active={from:number;rows:RowBounds[];startY:number;startScroll:number;left:number;right:number};
type Controls={drag:Preview|null;busy:boolean;count:number;start:(e:PointerEvent<HTMLButtonElement>,index:number)=>void;finish:(e:PointerEvent<HTMLButtonElement>,cancel?:boolean)=>void;point:(e:PointerEvent<HTMLButtonElement>)=>void;move:(from:number,to:number)=>Promise<boolean>};
const Context=createContext<Controls|null>(null);
export function ReorderList({children,busy,count,onMove,onDraggingChange}:{children:ReactNode;busy:boolean;count:number;onMove:(from:number,to:number)=>Promise<boolean>;onDraggingChange:(dragging:boolean)=>void}){
 const root=useRef<HTMLUListElement>(null),active=useRef<Active|null>(null),pointer=useRef({x:0,y:0}),frame=useRef<number|null>(null);
 const callbacks=useRef({onMove,onDraggingChange});callbacks.current={onMove,onDraggingChange};
 const [drag,setDrag]=useState<Preview|null>(null);
 const stop=()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;};
 useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);active.current=null;callbacks.current.onDraggingChange(false);},[]);
 const preview=()=>{const a=active.current;return a?reorderPreview(a.rows,a.from,pointer.current.y-a.startY+window.scrollY-a.startScroll):null;};
 const update=()=>{const next=preview();if(next)setDrag(previous=>previous&&previous.to===next.to&&previous.delta===next.delta?previous:next);};
 const tick=()=>{if(!active.current)return;const {y}=pointer.current;if(y<90)window.scrollBy(0,-Math.min(14,(90-y)/5));else if(y>window.innerHeight-90)window.scrollBy(0,Math.min(14,(y-window.innerHeight+90)/5));update();frame.current=requestAnimationFrame(tick);};
 const start=(e:PointerEvent<HTMLButtonElement>,index:number)=>{if(busy||e.button!==0||active.current||!root.current)return;const nodes=Array.from(root.current.children).filter((node):node is HTMLLIElement=>node instanceof HTMLLIElement);const rows=nodes.map(node=>{const r=node.getBoundingClientRect();return {top:r.top+window.scrollY,bottom:r.bottom+window.scrollY};});if(!rows[index])return;e.preventDefault();const bounds=root.current.getBoundingClientRect();pointer.current={x:e.clientX,y:e.clientY};active.current={from:index,rows,startY:e.clientY,startScroll:window.scrollY,left:bounds.left,right:bounds.right};setDrag(reorderPreview(rows,index,0));callbacks.current.onDraggingChange(true);e.currentTarget.setPointerCapture(e.pointerId);frame.current=requestAnimationFrame(tick);};
 const finish=(e:PointerEvent<HTMLButtonElement>,cancel=false)=>{const a=active.current;if(!a)return;pointer.current={x:e.clientX,y:e.clientY};const result=preview();const outside=e.clientX<a.left-24||e.clientX>a.right+24;active.current=null;stop();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);setDrag(null);callbacks.current.onDraggingChange(false);
 // Commit the visual order at drop time. The parent queues persistence in the background.
 if(!cancel&&!outside&&result&&result.from!==result.to&&!busy)void callbacks.current.onMove(result.from,result.to);};

 const point=(e:PointerEvent<HTMLButtonElement>)=>{pointer.current={x:e.clientX,y:e.clientY};update();};
 return <Context.Provider value={{drag,busy,count,start,finish,point,move:onMove}}><ul ref={root} className={`dish-list ${drag?'is-dragging':''}`}>{children}</ul><span className="sr-only" role="status" aria-live="polite">{drag?`מיקום ${drag.to+1} מתוך ${count}`:''}</span></Context.Provider>;
}
export function ReorderRow({index,className,children}:{index:number;className:string;children:ReactNode}){const c=useContext(Context);const drag=c?.drag,source=drag?.from===index;return <li data-reorder-index={index} className={`${className} sortable-dish-row ${source?'drag-lifted':''}`} style={{transform:drag?`translate3d(0,${drag.offsets[index]||0}px,0)`:undefined,zIndex:source?10:undefined}}>{children}</li>;}
export function DragHandle({index,name}:{index:number;name:string}){const c=useContext(Context)!;return <button type="button" className="icon-action drag-handle" disabled={c.busy} aria-label={`גרירת ${name} לסידור`} aria-describedby="drag-instructions" onPointerDown={e=>c.start(e,index)} onPointerMove={c.point} onPointerUp={e=>c.finish(e)} onPointerCancel={e=>c.finish(e,true)} onLostPointerCapture={e=>c.finish(e,true)} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const to=index+(e.key==='ArrowUp'?-1:1);if(to>=0&&to<c.count&&!c.busy)void c.move(index,to);}}}><GripVertical size={21}/></button>;}
