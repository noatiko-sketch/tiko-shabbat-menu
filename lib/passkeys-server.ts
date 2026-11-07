import {p256} from '@noble/curves/nist.js';
import {decodeCBOR,decodePartialCBOR} from '@levischuck/tiny-cbor';

type Hash=(bytes:Uint8Array)=>Uint8Array;
export type PasskeyCredential={id:string;publicKey:string;counter:number;backedUp:boolean;backupEligible:boolean;userId:string;label:string;createdAt:number;lastUsedAt?:number};
export type PasskeyChallenge={id:string;value:string;purpose:'register'|'login';expires:number;userId?:string;label?:string};
export type PasskeySession={hash:string;credentialId:string;expires:number;codeVersion:string};
export type PasskeyState={credentials:PasskeyCredential[];challenges:PasskeyChallenge[];sessions:PasskeySession[]};
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function toBase64url(bytes:Uint8Array){let out='';for(let i=0;i<bytes.length;i+=3){const n=(bytes[i]<<16)|((bytes[i+1]||0)<<8)|(bytes[i+2]||0);out+=alphabet[(n>>>18)&63]+alphabet[(n>>>12)&63];if(i+1<bytes.length)out+=alphabet[(n>>>6)&63];if(i+2<bytes.length)out+=alphabet[n&63];}return out;}
export function fromBase64url(value:unknown,max=16384){
 passkeyCheck(typeof value==='string'&&value.length>0&&value.length<=max&&/^[A-Za-z0-9_-]+$/.test(value),'תשובת המכשיר אינה תקינה.');
 const text=value as string,out:number[]=[];let bits=0,buffer=0;
 for(const c of text){buffer=(buffer<<6)|alphabet.indexOf(c);bits+=6;if(bits>=8){bits-=8;out.push((buffer>>>bits)&255);}}
 const bytes=Uint8Array.from(out);passkeyCheck(toBase64url(bytes)===text,'תשובת המכשיר אינה תקינה.');return bytes;
}
export function passkeyCheck(value:unknown,message='אימות המכשיר נכשל. נסו שוב או השתמשו בקוד המשפחתי.',status=400):asserts value{if(!value)throw {status,message};}
export function passkeyText(bytes:Uint8Array){return decodeURIComponent(Array.from(bytes,b=>'%'+b.toString(16).padStart(2,'0')).join(''));}
export function passkeyBytes(text:string){const encoded=encodeURIComponent(text);const out:number[]=[];for(let i=0;i<encoded.length;i++){if(encoded[i]==='%'){out.push(parseInt(encoded.slice(i+1,i+3),16));i+=2;}else out.push(encoded.charCodeAt(i));}return Uint8Array.from(out);}
function same(a:Uint8Array,b:Uint8Array){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}
function join(a:Uint8Array,b:Uint8Array){const result=new Uint8Array(a.length+b.length);result.set(a);result.set(b,a.length);return result;}
function uint32(data:Uint8Array,offset:number){return new DataView(data.buffer,data.byteOffset,data.byteLength).getUint32(offset,false);}
function clientData(response:any,challenge:PasskeyChallenge,type:string,origin:string,now:number){
 passkeyCheck(challenge.expires>now,'בקשת הכניסה פגה. יש לנסות שוב.',401);
 const bytes=fromBase64url(response?.clientDataJSON,8192);let data:any;try{data=JSON.parse(passkeyText(bytes));}catch{passkeyCheck(false);}
 passkeyCheck(data.type===type&&data.challenge===challenge.value&&data.origin===origin&&data.crossOrigin!==true&&!data.topOrigin,'הבקשה אינה שייכת לאתר טיקו או לניסיון הכניסה הנוכחי.',401);
 return bytes;
}
function authenticator(data:Uint8Array,rpId:string,hash:Hash){
 passkeyCheck(data.length>=37&&data.length<=8192);
 passkeyCheck(same(data.slice(0,32),hash(passkeyBytes(rpId))),'מפתח הגישה אינו שייך לאתר טיקו.',401);
 const flags=data[32];passkeyCheck((flags&1)!==0&&(flags&4)!==0,'נדרש אישור באמצעות נעילת המכשיר.',401);
 passkeyCheck(!(flags&16)||(flags&8)!==0);
 return {flags,counter:uint32(data,33),backupEligible:!!(flags&8),backedUp:!!(flags&16)};
}
export function newPasskeyState():PasskeyState{return {credentials:[],challenges:[],sessions:[]};}
export function prunePasskeys(state:PasskeyState,now:number){state.challenges=state.challenges.filter(c=>c.expires>now);state.sessions=state.sessions.filter(s=>s.expires>now&&state.credentials.some(c=>c.id===s.credentialId));}
export function takePasskeyChallenge(state:PasskeyState,id:unknown,purpose:PasskeyChallenge['purpose'],now:number){
 const index=state.challenges.findIndex(c=>c.id===id&&c.purpose===purpose);passkeyCheck(index>=0,'בקשת הכניסה פגה או כבר נוצלה. נסו שוב.',401);
 const [challenge]=state.challenges.splice(index,1);passkeyCheck(challenge.expires>now,'בקשת הכניסה פגה. נסו שוב.',401);return challenge;
}
export function verifyPasskeyRegistration(answer:any,challenge:PasskeyChallenge,rpId:string,origin:string,now:number,hash:Hash):PasskeyCredential{
 passkeyCheck(answer?.type==='public-key'&&answer.id===answer.rawId);const id=fromBase64url(answer.id,1400);passkeyCheck(id.length<=1024);
 clientData(answer.response,challenge,'webauthn.create',origin,now);
 let attestation:any;try{attestation=decodeCBOR(fromBase64url(answer.response.attestationObject,16000));}catch{passkeyCheck(false);}
 passkeyCheck(attestation instanceof Map&&attestation.get('fmt')==='none'&&attestation.get('attStmt') instanceof Map&&attestation.get('attStmt').size===0);
 const data=attestation.get('authData');passkeyCheck(data instanceof Uint8Array);
 const info=authenticator(data,rpId,hash);passkeyCheck((info.flags&64)!==0&&data.length>=55);
 const idLength=(data[53]<<8)|data[54];passkeyCheck(idLength===id.length&&data.length>55+idLength&&same(id,data.slice(55,55+idLength)));
 let cose:any;try{const decoded=decodePartialCBOR(data,55+idLength);cose=decoded[0];const end=55+idLength+decoded[1];if(info.flags&128)passkeyCheck(decodeCBOR(data.slice(end)) instanceof Map);else passkeyCheck(end===data.length);}catch{passkeyCheck(false);}
 passkeyCheck(cose instanceof Map&&cose.get(1)===2&&cose.get(3)===-7&&cose.get(-1)===1,'סוג מפתח הגישה אינו נתמך במכשיר הזה.');
 const x=cose.get(-2),y=cose.get(-3);passkeyCheck(x instanceof Uint8Array&&y instanceof Uint8Array&&x.length===32&&y.length===32);
 const publicKey=join(Uint8Array.of(4),join(x,y));try{p256.Point.fromBytes(publicKey).assertValidity();}catch{passkeyCheck(false);}
 passkeyCheck(challenge.userId&&challenge.label);
 return {id:answer.id,publicKey:toBase64url(publicKey),counter:info.counter,backupEligible:info.backupEligible,backedUp:info.backedUp,userId:challenge.userId,label:challenge.label,createdAt:now};
}
export function verifyPasskeyAuthentication(answer:any,challenge:PasskeyChallenge,credential:PasskeyCredential,rpId:string,origin:string,now:number,hash:Hash){
 passkeyCheck(answer?.type==='public-key'&&answer.id===credential.id&&answer.rawId===credential.id,'מפתח הגישה אינו מוכר.',401);
 const client=clientData(answer.response,challenge,'webauthn.get',origin,now),data=fromBase64url(answer.response.authenticatorData,12000),info=authenticator(data,rpId,hash);
 passkeyCheck(!(info.flags&64)&&info.backupEligible===credential.backupEligible);
 if(answer.response.userHandle!==null&&answer.response.userHandle!==undefined)passkeyCheck(answer.response.userHandle===credential.userId,'מפתח הגישה אינו שייך למשפחה.',401);
 let verified=false;try{verified=p256.verify(fromBase64url(answer.response.signature,220),join(data,hash(client)),fromBase64url(credential.publicKey,100),{format:'der',lowS:false,prehash:true});}catch{}
 passkeyCheck(verified,'אימות מפתח הגישה נכשל.',401);
 passkeyCheck(!((info.counter>0||credential.counter>0)&&info.counter<=credential.counter),'התקבלה תשובת אימות ישנה. השתמשו בקוד המשפחתי ובדקו את מפתח הגישה.',401);
 credential.counter=info.counter;credential.backedUp=info.backedUp;credential.lastUsedAt=now;
}
