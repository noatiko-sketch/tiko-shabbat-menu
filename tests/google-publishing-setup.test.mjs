import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publishingCredential,validatePublishingScopes} from '../scripts/setup-google-publishing.mjs';

test('publishing setup selects only its named account and exports only reusable fields',()=>{
 const value=publishingCredential({tokens:{default:{refresh_token:'unrelated-account'},'tiko-github-publishing':{client_id:'fake-client',client_secret:'fake-secret',refresh_token:'fake-refresh',access_token:'temporary-access',scope:'https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.deployments'}}});
 assert.deepEqual(value,{client_id:'fake-client',client_secret:'fake-secret',refresh_token:'fake-refresh'});
 assert.equal(JSON.stringify(value).includes('temporary-access'),false);
 assert.equal(JSON.stringify(value).includes('unrelated-account'),false);
});

test('publishing setup rejects another account or missing refresh permission, and accepts actual clasp format without stored scopes',()=>{
 assert.throws(()=>publishingCredential({tokens:{default:{client_id:'fake',client_secret:'fake',refresh_token:'fake'}}}),/did not save/);
 assert.throws(()=>publishingCredential({tokens:{'tiko-github-publishing':{client_id:'fake',client_secret:'fake'}}}),/did not save/);
 assert.deepEqual(publishingCredential({tokens:{'tiko-github-publishing':{client_id:'fake',client_secret:'fake',refresh_token:'fake'}}}),{client_id:'fake',client_secret:'fake',refresh_token:'fake'});
});

test('publishing permissions come from Google tokeninfo, with credentials in a header instead of URL',async()=>{
 await validatePublishingScopes('fake-access',async(url,options)=>{
  assert.equal(url,'https://oauth2.googleapis.com/tokeninfo');
  assert.equal(options.method,'POST');
  assert.equal(options.headers.authorization,'Bearer fake-access');
  return {ok:true,json:async()=>({scope:'https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.deployments'})};
 });
 for(const scope of ['', 'https://www.googleapis.com/auth/script.projects'])await assert.rejects(validatePublishingScopes('fake',async()=>({ok:true,json:async()=>({scope})})),/approve both/);
 await assert.rejects(validatePublishingScopes('fake',async()=>({ok:false})),/could not verify/);
});
