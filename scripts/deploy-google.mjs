import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Uses the existing project/deployment. Preserve the old Index and manifest;
// updateContent replaces the complete project, so a partial upload is unsafe.
export async function deployGoogle(config,credentials,code,bridge,transport=fetch,mobile=null){
 if(!config.scriptId||!config.deploymentId||!config.codeFileName)throw Error('Missing Google deployment configuration.');
 if(!credentials?.client_id||!credentials?.client_secret||!credentials?.refresh_token)throw Error('Configure the GOOGLE_SCRIPT_OAUTH GitHub secret before automatic Google deployment.');
 async function json(url,options){const response=await transport(url,{...options,signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`Google deployment request failed (${response.status}). No credentials or server response are logged.`);return response.json();}
 const token=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...credentials,grant_type:'refresh_token'})});
 if(!token.access_token)throw Error('Google did not issue an access token.');
 const headers={authorization:`Bearer ${token.access_token}`,'content-type':'application/json'};
 const root=`https://script.googleapis.com/v1/projects/${encodeURIComponent(config.scriptId)}`;
 const current=await json(root+'/content',{headers});
 if(!current.files?.some(f=>f.name==='appsscript'&&f.type==='JSON')||!current.files.some(f=>f.name===config.codeFileName&&f.type==='SERVER_JS'))throw Error('Existing script files do not match the expected project; no code was changed.');
 const deployment=await json(root+'/deployments/'+encodeURIComponent(config.deploymentId),{headers});
 if(deployment.deploymentConfig?.scriptId!==config.scriptId||!deployment.deploymentConfig?.versionNumber)throw Error('Existing deployment does not match the expected project.');
 const files=current.files.filter(f=>f.name!==config.codeFileName&&f.name!=='Bridge'&&(mobile===null||f.name!=='Mobile')).map(({name,type,source})=>({name,type,source}));
 files.push({name:config.codeFileName,type:'SERVER_JS',source:code},{name:'Bridge',type:'HTML',source:bridge});
 if(mobile!==null)files.push({name:'Mobile',type:'HTML',source:mobile});
 await json(root+'/content',{method:'PUT',headers,body:JSON.stringify({files})});
 const version=await json(root+'/versions',{method:'POST',headers,body:JSON.stringify({description:'GitHub '+(process.env.GITHUB_SHA||'manual').slice(0,12)})});
 if(!Number.isInteger(version.versionNumber))throw Error('Google did not create a version.');
 await json(root+'/deployments/'+encodeURIComponent(config.deploymentId),{method:'PUT',headers,body:JSON.stringify({deploymentConfig:{...deployment.deploymentConfig,versionNumber:version.versionNumber,description:'Tiko — GitHub Pages'}})});
 return version.versionNumber;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const config={...JSON.parse(readFileSync('google/deployment.json','utf8')),scriptId:process.env.TIKO_GOOGLE_SCRIPT_ID};
 const credentials=JSON.parse(process.env.GOOGLE_SCRIPT_OAUTH||'{}');
 const version=await deployGoogle(config,credentials,readFileSync('google/Code.gs','utf8'),readFileSync('google/Bridge.html','utf8'),fetch,readFileSync('work/google-Mobile.html','utf8'));
 console.log(`Updated the existing Apps Script deployment to version ${version}.`);
}
