import {pathToFileURL} from 'node:url';

export async function archiveShabbat(siteUrl,transport=fetch){
 const origin=new URL(siteUrl);
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw Error('TIKO_SITE_URL must be an HTTPS site origin.');
 const response=await transport(new URL('/api/menu',origin),{
  method:'POST',
  headers:{'content-type':'application/json','x-family-member':encodeURIComponent('נעה')},
  body:JSON.stringify({type:'archive_completed'}),
  signal:AbortSignal.timeout(60000),
 });
 if(!response.ok)throw Error(`Archive request failed (${response.status}).`);
 const data=await response.json();
 if(!Number.isInteger(data.archived)||data.archived<0||data.snapshot?.storage!=='google-drive'||data.snapshot?.state_id!=='1wc9VbyXuLl9QTWVPLUYiU1vUQjz1vmZI'||data.snapshot?.status!=='ready')throw Error('Archive response did not confirm the original Drive database.');
 return data.archived;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const count=await archiveShabbat(process.env.TIKO_SITE_URL);
 console.log(`Archived ${count} completed Shabbat menus in the original Drive database.`);
}
