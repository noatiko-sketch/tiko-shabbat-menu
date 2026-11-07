// WebAuthn is called by the top-level Pages origin, never inside the Google iframe.
export function supportsPasskeys(){return typeof window!=='undefined'&&window.isSecureContext&&typeof PublicKeyCredential!=='undefined'&&!!navigator.credentials?.create&&!!navigator.credentials?.get;}
function decode(value:string){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
function encode(value:ArrayBuffer){return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function passkeyMessage(error:unknown){
 if(error instanceof DOMException){
  if(error.name==='NotAllowedError')return 'הבקשה בוטלה או שלא נמצא מפתח גישה. אפשר לנסות שוב או להיכנס בקוד המשפחתי.';
  if(error.name==='InvalidStateError')return 'כבר קיים מפתח גישה מתאים במכשיר או במנהל הסיסמאות שלך.';
  if(error.name==='NotSupportedError')return 'המכשיר או הדפדפן אינם תומכים בסוג מפתח הגישה. אפשר להשתמש בקוד המשפחתי.';
  if(error.name==='SecurityError')return 'הדפדפן אינו מאפשר מפתח גישה לכתובת הזו. פתחו את אתר טיקו החדש בחלון דפדפן רגיל.';
 }
 return error instanceof Error?error.message:'לא ניתן להשלים את הכניסה. אפשר להשתמש בקוד המשפחתי.';
}
export async function createPasskey(options:any){
 if(!supportsPasskeys())throw Error('הדפדפן אינו תומך במפתחות גישה. פתחו את טיקו ב־Chrome או Safari מעודכן.');
 const publicKey:PublicKeyCredentialCreationOptions={...options,challenge:decode(options.challenge),user:{...options.user,id:decode(options.user.id)},excludeCredentials:(options.excludeCredentials||[]).map((c:any)=>({...c,id:decode(c.id)}))};
 const credential=await navigator.credentials.create({publicKey}) as PublicKeyCredential|null;
 if(!credential)throw Error('לא נוצר מפתח גישה.');
 const response=credential.response as AuthenticatorAttestationResponse;
 return {id:credential.id,rawId:encode(credential.rawId),type:credential.type,response:{clientDataJSON:encode(response.clientDataJSON),attestationObject:encode(response.attestationObject)}};
}
export async function authenticatePasskey(options:any){
 if(!supportsPasskeys())throw Error('הדפדפן אינו תומך במפתחות גישה. אפשר להיכנס בקוד המשפחתי.');
 const publicKey:PublicKeyCredentialRequestOptions={...options,challenge:decode(options.challenge)};
 const credential=await navigator.credentials.get({publicKey}) as PublicKeyCredential|null;
 if(!credential)throw Error('לא התקבל מפתח גישה.');
 const response=credential.response as AuthenticatorAssertionResponse;
 return {id:credential.id,rawId:encode(credential.rawId),type:credential.type,response:{clientDataJSON:encode(response.clientDataJSON),authenticatorData:encode(response.authenticatorData),signature:encode(response.signature),userHandle:response.userHandle?encode(response.userHandle):null}};
}
