import assert from 'node:assert/strict';
import {test} from 'node:test';
import {dishCandidates} from '../lib/dish-candidates.ts';
const catalog=[{name:'מרק אפונה',category:'soup'},{name:'מרק פטריות עם שמנת',category:'soup'},{name:'מרק עוף',category:'soup'},{name:'סלט ירקות',category:'salad'},{name:'מרק עדשים חדש',category:'soup'}];
test('replacement is restricted to its category and still excludes incompatible ingredients',()=>{
 assert.deepEqual(dishCandidates(catalog,'lunch',3,'soup').map(d=>d.name),['מרק אפונה','מרק עוף','מרק עדשים חדש']);
 assert.deepEqual(dishCandidates(catalog,'friday',1,'soup').map(d=>d.name),['מרק אפונה','מרק פטריות עם שמנת','מרק עדשים חדש']);
 assert.deepEqual(dishCandidates(catalog,'friday',1,'salad').map(d=>d.name),['סלט ירקות']);
 assert.deepEqual(dishCandidates(catalog,'friday',1,'dessert'),[]);
});
test('adding a slot permits other compatible categories and includes newly added dishes',()=>{
 assert.equal(dishCandidates(catalog,'friday',1).some(d=>d.category==='salad'),true);
 const newCatalog=[...catalog,{name:'סלט קישואים חדש',category:'salad'}];
 assert.deepEqual(dishCandidates(newCatalog,'friday',1,'salad').map(d=>d.name),['סלט ירקות','סלט קישואים חדש']);
 assert.equal(catalog.length,5);
});
