import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionTrace} from '../cnidaria-motion-core.mjs';

test('invalid magnitude permanently invalidates attempt until reset',()=>{
 const trace=createMotionTrace();
 assert.equal(trace.add({timestamp:100,magnitude:9.8}),true);
 assert.equal(trace.add({timestamp:120,magnitude:NaN}),false);
 assert.equal(trace.add({timestamp:140,magnitude:9.8}),true);
 assert.deepEqual(trace.evaluate(),{ok:false,reason:'invalid motion trace sample'});
 trace.reset();
 assert.equal(trace.add({timestamp:100,magnitude:9.8}),true);
 assert.notEqual(trace.evaluate().reason,'invalid motion trace sample');
});
test('out-of-order and duplicate samples fail closed instead of silently dropping evidence',()=>{
 for(const invalid of [100,90]){
  const trace=createMotionTrace();
  trace.add({timestamp:100,magnitude:9.8});
  assert.equal(trace.add({timestamp:invalid,magnitude:9.8}),false);
  assert.equal(trace.evaluate().reason,'invalid motion trace sample');
 }
});
test('invalid sample structure and negative spin fail closed',()=>{
 for(const invalid of [null,[],{timestamp:120,magnitude:9.8,spin:-1}]){
  const trace=createMotionTrace();
  trace.add({timestamp:100,magnitude:9.8});
  assert.equal(trace.add(invalid),false);
  assert.equal(trace.evaluate().reason,'invalid motion trace sample');
 }
});
test('overflow retains priority over invalid samples, reset clears both',()=>{
 const trace=createMotionTrace({maxSamples:1});
 trace.add({timestamp:100,magnitude:9.8});
 trace.add(null);
 trace.add({timestamp:120,magnitude:9.8});
 assert.equal(trace.evaluate().reason,'motion trace capacity exceeded');
 trace.reset();
 trace.add({timestamp:200,magnitude:9.8});
 assert.notEqual(trace.evaluate().reason,'motion trace capacity exceeded');
});
