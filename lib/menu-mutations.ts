import type {Action} from './menu-model.ts';
import {projectAction,type MutationSnapshot} from './optimistic-menu.ts';

type Snapshot = MutationSnapshot;
type Task<S>={action:Action;revision:number;catalogRevision:number;send:(revision:number,catalogRevision:number)=>Promise<S>;resolve:(ok:boolean)=>void;reject:(error:unknown)=>void};

// Keep Drive writes serial, while rendering all unconfirmed moves immediately.
// A failed write cancels dependent index-based actions rather than moving a wrong dish.
export class MenuMutations<S extends Snapshot> {
 private tasks:Task<S>[]=[];
 private confirmed:S|null=null;
 private read:()=>S|null;
 private publish:(snapshot:S)=>void;
 private status:(saving:boolean,blocking:boolean)=>void;
 constructor(read:()=>S|null,publish:(snapshot:S)=>void,status:(saving:boolean,blocking:boolean)=>void){this.read=read;this.publish=publish;this.status=status;}
 enqueue(action:Action,send:Task<S>['send']):Promise<boolean>{
  if(!this.tasks.length)this.confirmed=this.read();
  if(!this.confirmed)return Promise.resolve(false);
  // Validate before enqueueing, so a bad form cannot poison the write queue.
  const base=this.visible();projectAction(base,action);
  const result=new Promise<boolean>((resolve,reject)=>this.tasks.push({action,revision:base.revision||0,catalogRevision:base.catalog_revision||0,send,resolve,reject}));
  this.notify();
  if(this.tasks.length===1)void this.drain();
  return result;
 }
 private visible():S{let visible=this.confirmed!;for(const {action} of this.tasks)visible=projectAction(visible,action);return visible;}
 private notify(){
  if(this.confirmed)this.publish(this.visible());
  this.status(this.tasks.length>0,false);
 }
 private async drain(){
  while(this.tasks.length){
   const task=this.tasks[0];
   try{
    this.confirmed=await task.send(task.revision,task.catalogRevision);
    this.tasks.shift();this.notify();task.resolve(true);
   }catch(error){
    const cancelled=this.tasks.splice(0);this.notify();
    for(const task of cancelled)task.reject(error);
    return;
   }
  }
 }
}
