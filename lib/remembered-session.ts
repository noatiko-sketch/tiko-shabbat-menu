// A revocable random token, never the family code or biometric data.
export type RememberedSession={token:string;expiresAt:number;sessionId:string};
export function readRememberedSession(storage:Pick<Storage,'getItem'|'removeItem'>,key:string,now=Date.now()):RememberedSession|null{
 try{const value=JSON.parse(storage.getItem(key)||'null');if(value&&/^[A-Za-z0-9_-]{43}$/.test(value.token)&&typeof value.sessionId==='string'&&Number.isFinite(value.expiresAt)&&value.expiresAt>now&&value.expiresAt<=now+366*24*60*60*1000)return value;storage.removeItem(key);}catch{}return null;
}
export function storeRememberedSession(storage:Pick<Storage,'setItem'>,key:string,value:RememberedSession){try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
export function deviceLabel(){if(typeof navigator==='undefined')return 'המכשיר הזה';const agent=navigator.userAgent;return /Android/i.test(agent)?'אנדרואיד':/iPhone|iPad/i.test(agent)?'אייפון / אייפד':'מחשב';}
