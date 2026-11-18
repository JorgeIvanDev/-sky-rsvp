import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionTrace,replay,replayObserved} from '../cnidaria-motion-core.mjs';

// Safety boundaries, not claims that a phone was physically caught.
test('observation options cannot shorten the required 350ms window',()=>{
 for(const options of [null,[],{observationMs:249},{observationMs:349},{observationMs:351},{maxGapMs:101},{maxGapMs:0},{minPostSamples:7}]){
  assert.deepEqual(replayObserved([],options),{ok:false,reason:'invalid observation settings'});
 }
});
test('invalid trailing sensor evidence cannot be hidden behind an earlier candidate',()=>{
 const samples=[{ms:0,m:20},{ms:20,m:1},{ms:60,m:1},{ms:100,m:1},{ms:140,m:1},{ms:180,m:1},{ms:220,m:1},{ms:260,m:1},{ms:300,m:1},{ms:340,m:1},{ms:380,m:1},{ms:420,m:20},{ms:440,m:22},{ms:460,m:9.8},{ms:480,m:9.8},{ms:500,m:9.8},{ms:520,m:9.8}];
 for(const tail of [{ms:520,m:9.8},{ms:540,m:NaN},{ms:530,m:9.8},{ms:540,m:9.8,spin:-1}]){
  const corrupted=[...samples,tail];
  assert.equal(replay(corrupted).ok,false);
  assert.equal(replayObserved(corrupted).ok,false);
 }
});
test('fractional timestamp collisions invalidate the entire attempt, reset restores collection',()=>{
 const trace=createMotionTrace();
 assert.equal(trace.add({timestamp:100.1,magnitude:9.8}),true);
 assert.equal(trace.add({timestamp:100.2,magnitude:9.8}),false);
 assert.equal(trace.evaluate().reason,'invalid motion trace sample');
 trace.reset();
 assert.equal(trace.add({timestamp:100.2,magnitude:9.8}),true);
 assert.equal(trace.add({timestamp:120.2,magnitude:9.8}),true);
 assert.notEqual(trace.evaluate().reason,'invalid motion trace sample');
});
test('nonfinite and unsafe relative timestamps cannot produce scores',()=>{
 for(const timestamp of [Infinity,NaN,-1,Number.MAX_SAFE_INTEGER+1]){
  const trace=createMotionTrace();
  assert.equal(trace.add({timestamp,magnitude:9.8}),false);
  assert.equal(trace.evaluate().reason,'invalid motion trace sample');
 }
});
