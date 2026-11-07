import type {Action,Menu} from './menu-model.ts';

export type AssignmentToast={text:string;image:string};
// Capture the transition before optimistic rendering; unchanged/cleared assignments
// never celebrate. Count the projected menu so feedback does not wait for Google.
export function isNewAssignment(menu:Menu|null,action:Action):boolean{
 if(!menu||menu.saturday!==action.saturday||!action.meal||!['add','replace','assign'].includes(action.type)||!action.responsible)return false;
 return action.type==='add'||menu[action.meal].dishes[action.index??-1]?.prepared_by!==action.responsible;
}
export function assignmentToast(menu:Menu|null,action:Action):AssignmentToast|null{
 if(!menu||menu.saturday!==action.saturday||!action.meal||!action.responsible)return null;
 const assigned=action.type==='add'?menu[action.meal].dishes.find(d=>d?.name===action.dish?.name?.trim()&&d?.prepared_by===action.responsible):menu[action.meal].dishes[action.index??-1];
 if(assigned?.prepared_by!==action.responsible)return null;
 const dad=action.actor==='אבא';
 if(action.responsible!==action.actor)return {text:dad?'עוד תהרוג אותנו':'עוד תהרגי אותנו',image:'/toasts/bowl-minimal.webp'};
 const count=[...menu.friday.dishes,...menu.lunch.dishes].filter(d=>d?.prepared_by===action.actor).length;
 return {text:count>1?(dad?'באנה אתה מלך!':'באנה את מלכה!'):(dad?'אלוף אמא ואבא גאים בך':'אלופה אמא ואבא גאים בך'),image:'/toasts/parents-minimal.webp'};
}
