import assert from 'node:assert/strict';
import {test} from 'node:test';
import {protectAppBack} from '../lib/app-exit-history.ts';

function browserHistory(entries){
 let index=entries.length-1;
 const listeners=new Map();
 const dispatch=(type,event)=>listeners.get(type)?.(event);
 return {
  get index(){return index;},
  history:{
   get state(){return entries[index];},
   get length(){return entries.length;},
   pushState(state){entries.splice(index+1,Infinity,state);index++;},
   go(delta){
    const destination=index+delta;
    if(destination<0||destination>=entries.length)return;
    index=destination;
    dispatch('popstate',{state:entries[index]});
   },
  },
  addEventListener(type,listener){listeners.set(type,listener);},
  removeEventListener(type){listeners.delete(type);},
  interact(isTrusted=true){dispatch('click',{isTrusted});},
 };
}

test('Back requests confirmation after interaction and keeps the page in place until exit is accepted',()=>{
 const browser=browserHistory([null,{restored:true}]);
 let attempts=0;
 const guard=protectAppBack(browser,()=>attempts++,()=>{});
 browser.interact(false);
 assert.equal(browser.history.length,2);
 browser.interact();
 browser.interact();
 assert.equal(browser.history.length,3);
 browser.history.go(-1);
 browser.history.go(-1);
 assert.equal(attempts,2);
 assert.deepEqual(browser.history.state,{restored:true,tikoExitGuard:true});
 assert.equal(guard.leave(),true);
 assert.equal(browser.index,0);
 assert.equal(attempts,2);
 guard.dispose();
});

test('confirming Back in a standalone window releases the final history entry',()=>{
 const browser=browserHistory([null]);
 let attempts=0;
 const guard=protectAppBack(browser,()=>attempts++,()=>{});
 browser.interact();
 browser.history.go(-1);
 assert.equal(attempts,1);
 assert.equal(guard.leave(),false);
 assert.equal(browser.index,0);
 assert.equal(attempts,1);
 browser.interact();
 browser.history.go(-1);
 assert.equal(attempts,2);
 guard.dispose();
});
