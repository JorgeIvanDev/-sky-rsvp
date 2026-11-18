import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionTrace} from '../cnidaria-motion-core.mjs';

test('direct sample insertion cannot bypass the configured trace capacity',()=>{
 const trace=createMotionTrace({maxSamples:2});
 assert.equal(trace.add({timestamp:100,magnitude:9.8}),true);
 assert.equal(trace.add({timestamp:116,magnitude:9.7}),true);
 trace.samples.push({ms:32,m:9.8,spin:0});
 assert.deepEqual(trace.evaluate(),{ok:false,reason:'motion trace capacity exceeded'});
 trace.reset();
 assert.equal(trace.add({timestamp:200,magnitude:9.8}),true);
 assert.notEqual(trace.evaluate().reason,'motion trace capacity exceeded');
});

test('direct sample insertion below capacity still invalidates trace',()=>{
 const trace=createMotionTrace({maxSamples:5});
 trace.add({timestamp:100,magnitude:9.8});
 trace.samples.push({ms:16,m:9.8,spin:0});
 assert.deepEqual(trace.evaluate(),{ok:false,reason:'invalid motion trace sample'});
 trace.reset();
 assert.equal(trace.add({timestamp:300,magnitude:9.8}),true);
 assert.notEqual(trace.evaluate().reason,'invalid motion trace sample');
});

test('removing a collected sample cannot silently produce a score',()=>{
 const trace=createMotionTrace({maxSamples:5});
 trace.add({timestamp:100,magnitude:9.8});
 trace.add({timestamp:116,magnitude:9.8});
 trace.samples.pop();
 assert.deepEqual(trace.evaluate(),{ok:false,reason:'invalid motion trace sample'});
});
