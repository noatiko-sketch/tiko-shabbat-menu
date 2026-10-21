import assert from 'node:assert/strict';
import {test} from 'node:test';
import {reorderPreview} from '../lib/reorder-preview.ts';
const rows=[{top:100,bottom:180},{top:180,bottom:260},{top:260,bottom:340},{top:340,bottom:420}];
test('dragged row follows pointer continuously before crossing a row midpoint',()=>{
 const result=reorderPreview(rows,0,35);assert.equal(result.delta,35);assert.equal(result.to,0);assert.deepEqual(result.offsets,[35,0,0,0]);
});
test('downward drag shifts intervening rows upward and settles into the destination',()=>{
 const result=reorderPreview(rows,0,175);assert.equal(result.to,2);assert.deepEqual(result.offsets,[175,-80,-80,0]);assert.equal(result.settledDelta,160);
});
test('upward drag shifts intervening rows downward',()=>{
 const result=reorderPreview(rows,3,-175);assert.equal(result.to,1);assert.deepEqual(result.offsets,[0,80,80,-175]);assert.equal(result.settledDelta,-160);
});
test('variable row heights and gaps retain spacing during movement',()=>{
 const varied=[{top:0,bottom:80},{top:90,bottom:210},{top:220,bottom:300}];
 const result=reorderPreview(varied,0,240);assert.equal(result.to,2);assert.deepEqual(result.offsets,[220,-90,-90]);assert.equal(result.settledDelta,220);
});
test('drag stays within the list and can return to its original position',()=>{
 assert.equal(reorderPreview(rows,0,-500).delta,0);assert.equal(reorderPreview(rows,3,500).delta,0);
 assert.deepEqual(reorderPreview(rows,1,0).offsets,[0,0,0,0]);
 assert.deepEqual(reorderPreview([{top:10,bottom:90}],0,999).offsets,[0]);
});

test('a tall row can reach the last slot even when its visible movement is bounded',()=>{
 const varied=[{top:0,bottom:160},{top:160,bottom:220},{top:220,bottom:280}];
 const result=reorderPreview(varied,0,200);assert.equal(result.to,2);assert.equal(result.delta,120);assert.equal(result.settledDelta,120);assert.deepEqual(result.offsets,[120,-160,-160]);
});
