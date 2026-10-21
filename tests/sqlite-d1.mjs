import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
export function testDatabase(){
 const sqlite=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 class Statement{
 constructor(sql,args=[]){this.sql=sql;this.args=args;}
 bind(...args){return new Statement(this.sql,args);}
 execute(){const r=sqlite.prepare(this.sql).run(...this.args);return {success:true,results:[],meta:{changes:Number(r.changes)}};}
 async run(){return this.execute();}
 async all(){return {success:true,results:sqlite.prepare(this.sql).all(...this.args)};}
 async first(column){const row=sqlite.prepare(this.sql).get(...this.args);return column?row?.[column]??null:row??null;}
 }
 return {prepare:sql=>new Statement(sql),async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s.execute());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}},close:()=>sqlite.close()};
}
