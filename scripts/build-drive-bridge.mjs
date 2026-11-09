import fs from 'node:fs';
import ts from 'typescript';
import {buildSync} from 'esbuild';
const files=['lib/custom-categories.ts','lib/recipe-url.ts','lib/family.ts','lib/menu-model.ts','lib/drive-engine.ts','lib/shopping.ts','lib/shopping-scan.ts','lib/shopping-gemini.ts'];
const source=files.map(p=>fs.readFileSync(p,'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'')).join('\n');
const engine=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
const wrapper=fs.readFileSync('google/wrapper.gs','utf8');
const passkeysBundle=buildSync({entryPoints:['lib/passkeys-server.ts'],bundle:true,write:false,format:'iife',globalName:'TikoPasskeys',platform:'browser',target:'es2020',define:{TextDecoder:'TikoTextDecoder',TextEncoder:'TikoTextEncoder'}}).outputFiles[0].text;
// Apps Script's upload parser rejects bigint literal syntax even though V8
// supports BigInt arithmetic. Transform AST literals without touching strings.
const passkeys=ts.transpileModule(passkeysBundle,{compilerOptions:{target:ts.ScriptTarget.ES2020},transformers:{before:[context=>root=>{
 const visit=node=>ts.isBigIntLiteral(node)?ts.factory.createCallExpression(ts.factory.createIdentifier('BigInt'),undefined,[ts.factory.createStringLiteral(node.text.slice(0,-1))]):ts.visitEachChild(node,visit,context);
 return ts.visitNode(root,visit);
}]}}).outputText.replace(/[ \t]+$/gm,'');
// Apps Script V8 has typed arrays/BigInt but not TextEncoder/TextDecoder or WebCrypto.
// These strict UTF-8 adapters are only for the CBOR library; signature math is Noble's.
const encoding="class TikoTextDecoder{decode(bytes){return decodeURIComponent(Array.from(bytes,b=>'%'+b.toString(16).padStart(2,'0')).join(''));}}\nclass TikoTextEncoder{encode(text){var s=encodeURIComponent(text),a=[];for(var i=0;i<s.length;i++){if(s[i]==='%'){a.push(parseInt(s.slice(i+1,i+3),16));i+=2;}else a.push(s.charCodeAt(i));}return Uint8Array.from(a);}}\n";
const output=wrapper+'\n'+fs.readFileSync('google/passkeys-wrapper.gs','utf8')+'\n'+encoding+passkeys+'\nvar TikoDrive=(function(){\n'+engine+'\nreturn {initializeDrive,driveSnapshot,driveAction,mergeSiteExport,markDriveSeen,archiveCompletedShabbats,shoppingSnapshot,shoppingAction,reserveShoppingScan,clearWeeklyBought,geminiShoppingRequest,geminiShoppingResult,geminiShoppingError};\n})();\n';
if(process.argv.includes('--check')){
 if(fs.readFileSync('google/Code.gs','utf8')!==output){console.error('Google backend source is out of date. Run node scripts/build-drive-bridge.mjs.');process.exit(1);}
 console.log('Google backend source matches the shared TypeScript engine');
}else{fs.writeFileSync('google/Code.gs',output);console.log('Built Google Apps Script bridge from shared TypeScript engine');}
