import {build} from 'vite';
import {mobileLauncher} from './mobile-launcher.mjs';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';

const config=JSON.parse(readFileSync('google/deployment.json','utf8'));
const deployment=new URL(process.env.VITE_TIKO_GOOGLE_URL||`https://script.google.com/macros/s/${config.deploymentId}/exec`);
if(deployment.origin!=='https://script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(deployment.pathname)||deployment.search||deployment.hash)throw Error('VITE_TIKO_GOOGLE_URL must be an Apps Script /exec URL, without a secret or query string.');
process.env.VITE_TIKO_GOOGLE_URL=deployment.href;
await build({configFile:'vite.pages.config.ts'});
const base=process.env.TIKO_PAGES_BASE||'/tiko-shabbat-menu/';
const manifest=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));
for(const field of ['id','start_url','scope'])manifest[field]=base;
manifest.icons=manifest.icons.map(icon=>({...icon,src:base+icon.src.replace(/^\//,'')}));
writeFileSync('dist-pages/manifest.webmanifest',JSON.stringify(manifest));
for(const dir of ['install','install/help']){mkdirSync('dist-pages/'+dir,{recursive:true});copyFileSync('dist-pages/index.html','dist-pages/'+dir+'/index.html');}
const launcher=mobileLauncher({base,deployment:deployment.href});
mkdirSync('dist-pages/mobile',{recursive:true});
writeFileSync('dist-pages/mobile/index.html',launcher.html);
writeFileSync('dist-pages/mobile/manifest.webmanifest',JSON.stringify(launcher.manifest));
writeFileSync('dist-pages/.nojekyll','');
writeFileSync('dist-pages/sw.js',`const CACHE='tiko-pages-v1';const BASE=${JSON.stringify(base)};self.addEventListener('install',e=>{self.skipWaiting();});self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match(BASE+'offline.html').then(r=>r||new Response('יש להתחבר לאינטרנט',{headers:{'content-type':'text/plain;charset=utf-8'}}))));});`);
console.log('Built GitHub Pages site. No server credentials are included.');

// The same frontend can run in Google's own HTML Service on phones where the
// cross-site embedded bridge fails. No password or server token is embedded.
const pagesOrigin=config.pagesOrigin;
if(!/^https:\/\/[a-z0-9.-]+$/.test(pagesOrigin))throw Error('Invalid Pages origin.');
const assetBase=pagesOrigin+base;
let mobile=readFileSync('dist-pages/index.html','utf8');
mobile=mobile.replace(/(src|href)="(\/tiko-shabbat-menu\/[^"]*)"/g,(_,attribute,url)=>`${attribute}="${pagesOrigin}${url}"`);
mobile=mobile.replace('<meta name="tiko-base" content="'+base+'">','<meta name="tiko-base" content="'+assetBase+'">');
mobile=mobile.replace('</head>','<meta name="tiko-native" content="1"><script>window.TIKO_NATIVE_CONFIG=<?!= nativeConfig ?>;</script></head>');
mkdirSync('work',{recursive:true});writeFileSync('work/google-Mobile.html',mobile);
