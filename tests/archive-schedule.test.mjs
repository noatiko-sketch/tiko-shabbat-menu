import {test} from 'node:test';
import assert from 'node:assert/strict';
import {archiveShabbat} from '../scripts/archive-shabbat.mjs';

test('scheduled archive confirms the original Drive file without publishing menu contents',async()=>{
 const transport=async(url,options)=>{
  assert.equal(url.href,'https://family.example/api/menu');
  assert.equal(options.method,'POST');
  assert.deepEqual(JSON.parse(options.body),{type:'archive_completed'});
  assert.equal(decodeURIComponent(options.headers['x-family-member']),'נעה');
  return Response.json({archived:0,snapshot:{storage:'google-drive',state_id:'1wc9VbyXuLl9QTWVPLUYiU1vUQjz1vmZI',status:'ready'}});
 };
 assert.equal(await archiveShabbat('https://family.example',transport),0);
});

test('scheduled archive rejects an error or a different database',async()=>{
 await assert.rejects(archiveShabbat('https://family.example',async()=>new Response('',{status:503})),/503/);
 await assert.rejects(archiveShabbat('https://family.example',async()=>Response.json({archived:1,snapshot:{storage:'google-drive',state_id:'another-file',status:'ready'}})),/original Drive/);
});

test('scheduled archive rejects credentials, plaintext HTTP, and non-origin URLs',async()=>{
 for(const url of ['http://family.example','https://secret@family.example','https://family.example/path','https://family.example/?token=secret']){
  await assert.rejects(archiveShabbat(url,async()=>assert.fail('Invalid destination must not receive a request.')),/HTTPS site origin/);
 }
});
