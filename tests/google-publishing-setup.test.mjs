import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publishingCredential} from '../scripts/setup-google-publishing.mjs';

test('publishing setup selects only its named account and exports only reusable fields',()=>{
 const value=publishingCredential({tokens:{default:{refresh_token:'unrelated-account'},'tiko-github-publishing':{client_id:'fake-client',client_secret:'fake-secret',refresh_token:'fake-refresh',access_token:'temporary-access',scope:'https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.deployments'}}});
 assert.deepEqual(value,{client_id:'fake-client',client_secret:'fake-secret',refresh_token:'fake-refresh'});
 assert.equal(JSON.stringify(value).includes('temporary-access'),false);
 assert.equal(JSON.stringify(value).includes('unrelated-account'),false);
});

test('publishing setup rejects another account, missing refresh permission, or incomplete scopes',()=>{
 assert.throws(()=>publishingCredential({tokens:{default:{client_id:'fake',client_secret:'fake',refresh_token:'fake'}}}),/did not save/);
 assert.throws(()=>publishingCredential({tokens:{'tiko-github-publishing':{client_id:'fake',client_secret:'fake'}}}),/did not save/);
 assert.throws(()=>publishingCredential({tokens:{'tiko-github-publishing':{client_id:'fake',client_secret:'fake',refresh_token:'fake',scope:'https://www.googleapis.com/auth/script.projects'}}}),/both required/);
});
