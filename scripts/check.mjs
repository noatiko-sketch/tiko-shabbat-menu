import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
const tests=readdirSync(new URL('../tests/',import.meta.url)).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>'tests/'+f);
for(const args of [
 ['node_modules/typescript/bin/tsc','--noEmit','--incremental','false'],
 ['--experimental-strip-types','--test',...tests],
 ['scripts/build-drive-bridge.mjs','--check'],
]){
 const result=spawnSync(process.execPath,args,{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
