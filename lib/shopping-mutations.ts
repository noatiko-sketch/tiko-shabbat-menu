import {editShopping,type ShoppingAction,type ShoppingSnapshot} from './shopping.ts';
type ShoppingTask={action:ShoppingAction;send:(revision:number)=>Promise<ShoppingSnapshot>;resolve:()=>void;reject:(error:unknown)=>void};

// Render taps immediately, serialize writes, and roll back unconfirmed changes on failure.
export class ShoppingMutations {
 private tasks:ShoppingTask[]=[];
 private confirmed:ShoppingSnapshot|null=null;
 private read:()=>ShoppingSnapshot|null;
 private publish:(s:ShoppingSnapshot)=>void;
 private status:(saving:boolean)=>void;
 private actor:string;
 constructor(read:()=>ShoppingSnapshot|null,publish:(s:ShoppingSnapshot)=>void,status:(saving:boolean)=>void,actor:string){this.read=read;this.publish=publish;this.status=status;this.actor=actor;}
 enqueue(action:ShoppingAction,send:ShoppingTask['send']):Promise<void>{
  if(!this.tasks.length)this.confirmed=this.read();
  if(!this.confirmed)return Promise.reject(Error('הרשימה עדיין לא נטענה.'));
  editShopping(this.visible().shopping,action,this.actor,new Date().toISOString());
  const result=new Promise<void>((resolve,reject)=>this.tasks.push({action,send,resolve,reject}));
  this.notify();if(this.tasks.length===1)void this.drain();return result;
 }
 private visible(){let s=this.confirmed!;for(const t of this.tasks)s={...s,shopping:editShopping(s.shopping,t.action,this.actor,new Date().toISOString())};return s;}
 private notify(){if(this.confirmed)this.publish(this.visible());this.status(this.tasks.length>0);}
 private async drain(){
  while(this.tasks.length){
   const task=this.tasks[0];
   try{
    this.confirmed=await task.send(this.confirmed!.shopping.revision);
    this.tasks.shift();task.resolve();this.notify();
   }catch(error){
    const cancelled=this.tasks.splice(0);this.notify();for(const task of cancelled)task.reject(error);return;
   }
  }
 }
}
