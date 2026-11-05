import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deployGoogle} from '../scripts/deploy-google.mjs';

test('Google deployment preserves Index and manifest and updates the existing deployment',async()=>{
 const calls=[];
 const config={scriptId:'script',deploymentId:'deployment',codeFileName:'קוד'};
 const transport=async(url,options)=>{
  calls.push({url,options});
  if(url.includes('oauth2'))return Response.json({access_token:'fake-access-token'});
  if(url.endsWith('/content')&&!options.method)return Response.json({files:[{name:'קוד',type:'SERVER_JS',source:'old'},{name:'Index',type:'HTML',source:'original'},{name:'appsscript',type:'JSON',source:'{"timeZone":"Asia/Jerusalem"}'}]});
  if(url.endsWith('/deployments/deployment')&&!options.method)return Response.json({deploymentConfig:{scriptId:'script',versionNumber:11,manifestFileName:'appsscript'}});
  if(url.endsWith('/versions'))return Response.json({versionNumber:12});
  return Response.json({});
 };
 assert.equal(await deployGoogle(config,{client_id:'id',client_secret:'fake-secret',refresh_token:'fake-refresh'},'new-server','new-bridge',transport),12);
 const upload=JSON.parse(calls.find(c=>c.url.endsWith('/content')&&c.options.method==='PUT').options.body);
 assert.equal(upload.files.find(f=>f.name==='Index').source,'original');
 assert.equal(upload.files.find(f=>f.name==='appsscript').source,'{"timeZone":"Asia/Jerusalem"}');
 assert.equal(upload.files.find(f=>f.name==='קוד').source,'new-server');
 assert.equal(upload.files.find(f=>f.name==='Bridge').type,'HTML');
 const final=calls.at(-1);assert.equal(final.url,'https://script.googleapis.com/v1/projects/script/deployments/deployment');assert.equal(JSON.parse(final.options.body).deploymentConfig.versionNumber,12);
 assert.equal(calls.some(c=>c.url.includes('drive.googleapis.com')),false);
});

test('Google deployment without a secret makes no remote calls',async()=>{
 await assert.rejects(deployGoogle({scriptId:'s',deploymentId:'d',codeFileName:'קוד'},{},'','',async()=>assert.fail('No network without credentials.')),/GOOGLE_SCRIPT_OAUTH/);
});
