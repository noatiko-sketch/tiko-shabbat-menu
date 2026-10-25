import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import {upcomingSaturday} from '../lib/menu-model.ts';

// Only emulate Google's date-formatting service; never connect to Google Drive.
const Utilities={formatDate(date,timeZone,pattern){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const part=type=>parts.find(p=>p.type===type).value;
 if(pattern==='H')return part('hour');
 assert.equal(pattern,'yyyy-MM-dd');
 return `${part('year')}-${part('month')}-${part('day')}`;
}};

test('Apps Script context and site agree on the Saturday 18:00 cutover',()=>{
 const sandbox={Utilities};
 vm.runInNewContext(readFileSync(new URL('../google/Code.gs',import.meta.url),'utf8'),sandbox);
 for(const [instant,expected] of [
  ['2026-10-09T21:00:00Z','2026-10-10'],
  ['2026-10-10T14:59:59Z','2026-10-10'],
  ['2026-10-10T15:00:00Z','2026-10-17'],
  ['2026-10-10T21:00:00Z','2026-10-17'],
  ['2026-10-30T22:00:00Z','2026-10-31'],
  ['2026-10-31T15:59:59Z','2026-10-31'],
  ['2026-10-31T16:00:00Z','2026-11-07'],
  ['2026-10-31T22:00:00Z','2026-11-07'],
 ]){
  const now=new Date(instant),context=sandbox.context_(now);
  assert.equal(context.upcoming,expected,instant);
  assert.equal(context.upcoming,upcomingSaturday(now),instant);
  assert.equal(context.now,instant.replace('Z','.000Z'));
 }
});
