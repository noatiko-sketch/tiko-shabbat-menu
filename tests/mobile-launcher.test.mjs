import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {mobileLauncher} from '../scripts/mobile-launcher.mjs';

const deployment='https://script.google.com/macros/s/example/exec';
const {html,manifest}=mobileLauncher({base:'/tiko-shabbat-menu/',deployment});
test('home-screen entry exposes icons at the top level and stays installable',()=>{
 assert.match(html,/<link rel="apple-touch-icon" sizes="180x180" href="\/tiko-shabbat-menu\/icons\/icon-180.png">/);
 assert.equal(manifest.start_url,'/tiko-shabbat-menu/mobile/');
 assert.equal(manifest.scope,manifest.start_url);
 assert.match(html,/href="https:\/\/script.google.com\/macros\/s\/example\/exec\?mobile=1"/);
 assert.doesNotMatch(html,/<iframe/);
});
test('Safari shows installation instructions; installed launches open native Google connection',()=>{
 const script=html.match(/<script>(.*?)<\/script>/s)[1];
 for(const [ios,standalone,expected] of [[false,false,false],[true,false,true],[false,true,true]]){
  let opened;
  runInNewContext(script,{window:{navigator:{standalone:ios},matchMedia:()=>({matches:standalone}),location:{replace:url=>opened=url}}});
  assert.equal(opened,expected?deployment+'?mobile=1':undefined);
 }
});
