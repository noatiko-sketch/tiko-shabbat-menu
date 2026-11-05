// Run on the owner's computer, not inside ChatGPT. No credential is printed,
// put in a command argument, committed, or sent through the conversation.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {homedir,tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const REPO='noatiko-sketch/tiko-shabbat-menu';
const PROFILE='tiko-github-publishing';
const SCOPES=['https://www.googleapis.com/auth/script.projects','https://www.googleapis.com/auth/script.deployments','https://www.googleapis.com/auth/userinfo.email'];

export function publishingCredential(store){
 const value=store?.tokens?.[PROFILE];
 if(!value?.client_id||!value?.client_secret||!value?.refresh_token)throw Error('Google login did not save a reusable publishing credential. Run setup again and complete the Google sign-in.');
 // Exclude the short-lived access token, other accounts, and unrelated fields.
 return {client_id:value.client_id,client_secret:value.client_secret,refresh_token:value.refresh_token};
}

export async function validatePublishingScopes(token,request=fetch){
 // clasp 3.2 intentionally omits scope from its stored credential. Ask Google
 // about the live token instead, using the same POST as google-auth-library.
 const result=await request('https://oauth2.googleapis.com/tokeninfo',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8',authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});
 if(!result.ok)throw Error('Google could not verify publishing permissions. Run setup again without --resume.');
 const info=await result.json();
 const scopes=String(info.scope||'').split(/\s+/);
 for(const scope of SCOPES.slice(0,2))if(!scopes.includes(scope))throw Error('Google did not grant both Apps Script permissions. Run setup again without --resume and approve both.');
}

export async function setupGooglePublishing({resume=false}={}){
 if(Number(process.versions.node.split('.')[0])<20)throw Error('Install Node.js 20 or newer, reopen PowerShell, and run this tool again.');
 const gh=process.platform==='win32'?'gh.exe':'gh';
 function run(command,args,options={}){
  // cmd.exe is used only to start npx.cmd with fixed, non-secret arguments.
  // OAuth credentials reach gh secret set only on stdin, never through a shell.
  const result=spawnSync(command,args,{stdio:'inherit',...options});
  if(result.error||result.status!==0)throw Error('The setup command failed. Finish the sign-in or installation and run setup again. No credentials were displayed.');
  return result.stdout?.toString().trim();
 }
 const installed=spawnSync(gh,['--version'],{stdio:'ignore'});
 if(installed.error||installed.status!==0)throw Error('Install GitHub CLI, reopen PowerShell, then run this tool again.');
 if(spawnSync(gh,['auth','status','--hostname','github.com'],{stdio:'ignore'}).status!==0)run(gh,['auth','login','--hostname','github.com','--git-protocol','https','--web']);
 const admin=run(gh,['api','repos/'+REPO,'--jq','.permissions.admin'],{stdio:['ignore','pipe','ignore']});
 if(admin!=='true')throw Error('Sign in to GitHub CLI using the repository owner account, then run setup again.');
 const scriptId=run(gh,['variable','get','TIKO_GOOGLE_SCRIPT_ID','--repo',REPO],{stdio:['ignore','pipe','ignore']});
 if(!/^[A-Za-z0-9_-]{20,}$/.test(scriptId||''))throw Error('The TIKO_GOOGLE_SCRIPT_ID repository variable is missing or invalid.');
 if(!resume){
 const dir=mkdtempSync(path.join(tmpdir(),'tiko-google-setup-'));
 try{
  writeFileSync(path.join(dir,'.clasp.json'),JSON.stringify({scriptId}));
  writeFileSync(path.join(dir,'appsscript.json'),JSON.stringify({timeZone:'Asia/Jerusalem',runtimeVersion:'V8',oauthScopes:SCOPES}));
  console.log('Sign in to Google using the account that owns the Tiko Apps Script project.');
  const args=['--yes','@google/clasp@3.2.0','login','--user',PROFILE,'--use-project-scopes'];
  if(process.platform==='win32')run('cmd.exe',['/d','/s','/c','npx.cmd '+args.join(' ')],{cwd:dir});
  else run('npx',args,{cwd:dir});
 }finally{rmSync(dir,{recursive:true,force:true});}
 }
 const credential=publishingCredential(JSON.parse(readFileSync(path.join(homedir(),'.clasprc.json'),'utf8')));
 const refreshed=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...credential,grant_type:'refresh_token'}),signal:AbortSignal.timeout(30000)});
 if(!refreshed.ok)throw Error('Google could not refresh the publishing permission. Run setup again.');
 const token=await refreshed.json();
 if(!token.access_token)throw Error('Google did not issue a usable publishing token.');
 await validatePublishingScopes(token.access_token);
 const verify=await fetch('https://script.googleapis.com/v1/projects/'+encodeURIComponent(scriptId),{headers:{authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(30000)});
 if(!verify.ok)throw Error('Google API access is not ready. Enable Google Apps Script API at https://script.google.com/home/usersettings and run setup again.');
 const project=await verify.json();
 if(project.scriptId!==scriptId)throw Error('Google returned a different project. Nothing was saved in GitHub.');
 run(gh,['secret','set','GOOGLE_SCRIPT_OAUTH','--repo',REPO],{input:JSON.stringify(credential),stdio:['pipe','inherit','inherit']});
 console.log('Google publishing permission was saved in the shared repository. No secret was printed.');
 run(gh,['workflow','run','pages.yml','--ref','main','--repo',REPO,'--field','google_already_deployed=false']);
 console.log('A full Google + Pages deployment was requested. Check its result at https://github.com/'+REPO+'/actions');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 setupGooglePublishing({resume:process.argv.includes('--resume')}).catch(error=>{console.error(error.message);process.exitCode=1;});
}
