import assert from 'node:assert/strict';
import {test} from 'node:test';
import {opensAtShabbatLunch} from '../lib/menu-opening.ts';

test('the opening view switches at Friday 22:00 and Saturday 16:00 in Israel',()=>{
 for(const [time,expected] of [
  ['2026-11-20T19:59:59Z',false],
  ['2026-11-20T20:00:00Z',true],
  ['2026-11-20T22:00:00Z',true],
  ['2026-11-21T13:59:59Z',true],
  ['2026-11-21T14:00:00Z',false],
  ['2026-11-22T08:00:00Z',false],
  ['2026-07-17T18:59:59Z',false],
  ['2026-07-17T19:00:00Z',true],
  ['2026-07-18T12:59:59Z',true],
  ['2026-07-18T13:00:00Z',false],
 ]){
  assert.equal(opensAtShabbatLunch(new Date(time)),expected,time);
 }
});
