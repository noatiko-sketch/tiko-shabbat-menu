import fs from 'node:fs';
import ts from 'typescript';
const files=['lib/recipe-url.ts','lib/family.ts','lib/menu-model.ts','lib/drive-engine.ts'];
const source=files.map(p=>fs.readFileSync(p,'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'')).join('\n');
const engine=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
const wrapper=fs.readFileSync('google/wrapper.gs','utf8');
const output=wrapper+'\nvar TikoDrive=(function(){\n'+engine+'\nreturn {initializeDrive,driveSnapshot,driveAction,mergeSiteExport,markDriveSeen,archiveCompletedShabbats};\n})();\n';
if(process.argv.includes('--check')){
 if(fs.readFileSync('google/Code.gs','utf8')!==output){console.error('Google backend source is out of date. Run node scripts/build-drive-bridge.mjs.');process.exit(1);}
 console.log('Google backend source matches the shared TypeScript engine');
}else{fs.writeFileSync('google/Code.gs',output);console.log('Built Google Apps Script bridge from shared TypeScript engine');}
