import assert from 'node:assert/strict';
import {test} from 'node:test';
import {emptyMenu,editMenu} from '../lib/menu-model.ts';
import {isNewAssignment,assignmentToast} from '../lib/assignment-toast.ts';
const base=()=>emptyMenu('2026-10-24','2026-10-24',1);
const action=(overrides={})=>({type:'add',saturday:'2026-10-24',meal:'friday',dish:{name:'מרק אפונה',category:'soup'},actor:'נעה',responsible:'נעה',...overrides});
test('first self assignment and next dish in either meal use confirmed totals',()=>{
 const a=action();const before=base();assert.ok(isNewAssignment(before,a));
 const after=editMenu(before,a);assert.equal(assignmentToast(after,a).text,'אלופה אמא ואבא גאים בך');
 const b=action({meal:'lunch',dish:{name:'סלט',category:'salad'}});
 assert.equal(assignmentToast(editMenu(after,b),b).text,'באנה את מלכה!');
});
test('other-person assignment uses bowl; father receives masculine wording',()=>{
 for(const [actor,text] of [['נעה','עוד תהרגי אותנו'],['אבא','עוד תהרוג אותנו']]){
  const a=action({actor,responsible:'אמא'});const toast=assignmentToast(editMenu(base(),a),a);
  assert.equal(toast.text,text);assert.equal(toast.image,'/toasts/bowl-minimal.webp');
 }
 const a=action({actor:'אבא',responsible:'אבא'});assert.equal(assignmentToast(editMenu(base(),a),a).text,'אלוף אמא ואבא גאים בך');
});
test('no celebration for unchanged, cleared, unrelated or unconfirmed assignments',()=>{
 const a=action();const after=editMenu(base(),a);
 assert.equal(isNewAssignment(after,action({type:'replace',index:0})),false);
 assert.equal(isNewAssignment(after,action({type:'assign',index:0,responsible:''})),false);
 assert.equal(isNewAssignment(after,action({type:'move',index:0,toIndex:1})),false);
 assert.equal(assignmentToast(base(),a),null);assert.equal(assignmentToast(null,a),null);
});
test('new soup before dessert is found despite insertion away from end',()=>{
 const dessert=action({dish:{name:'פירות',category:'dessert'},responsible:'אביגיל'});
 const a=action();const after=editMenu(editMenu(base(),dessert),a);
 assert.equal(after.friday.dishes[0].name,'מרק אפונה');assert.ok(assignmentToast(after,a));
});
