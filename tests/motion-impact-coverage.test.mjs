import test from 'node:test';
import assert from 'node:assert/strict';
import {replayObserved, createMotionTrace} from '../cnidaria-motion-core.mjs';

// Deterministic synthetic sensor streams. These are not raw recordings of a hand catch.
const frames=(start,end,step,m)=>Array.from({length:Math.floor((end-start)/step)+1},(_,i)=>({ms:start+i*step,m}));
const launch=[{ms:0,m:30},...frames(20,840,20,0.5),{ms:860,m:20},{ms:880,m:28}];
const settle=()=>[...launch,...frames(900,1200,20,9.8),{ms:1230,m:9.8}];

test('full 350ms post-impact window yields catch-like, never verified hand catch',()=>{
 const result=replayObserved(settle());
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.classification,'catch-like only');
 assert.equal(result.observationMs,350);
 assert.notEqual(result.handCatchVerified,true);
});

test('second contact during the observation window rejects a couch-like rebound',()=>{
 const trace=[...launch,...frames(900,1020,20,9.8),{ms:1040,m:23},...frames(1060,1200,20,9.8),{ms:1230,m:9.8}];
 const result=replayObserved(trace);
 assert.equal(result.ok,false);
 assert.match(result.reason,/impact|spike|low-g/);
});

test('two distinct low-g bursts reject a tumbling landing',()=>{
 const trace=[...launch,...frames(900,940,20,9.8),...frames(960,1000,20,0.5),...frames(1020,1040,20,9.8),...frames(1060,1100,20,0.5),...frames(1120,1200,20,9.8),{ms:1230,m:9.8}];
 const result=replayObserved(trace);
 assert.equal(result.ok,false);
 assert.match(result.reason,/low-g|impact|spike/);
});

test('closing-frame timeout cannot establish settled observation',()=>{
 const trace=[...launch,...frames(900,1200,20,9.8),{ms:1500,m:9.8}];
 const result=replayObserved(trace);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'post-impact observation timeout');
});

test('invalid collector sample fails closed until reset, without scoring',()=>{
 const collector=createMotionTrace();
 assert.equal(collector.add({timestamp:100,magnitude:30}),true);
 assert.equal(collector.add({timestamp:120,magnitude:NaN}),false);
 assert.equal(collector.evaluate().ok,false);
 collector.reset();
 assert.equal(collector.add({timestamp:200,magnitude:30}),true);
 assert.equal(collector.evaluate().reason,'no catch');
});
