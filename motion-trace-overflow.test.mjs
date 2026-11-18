import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionTrace} from './cnidaria-motion-core.mjs';

const range=(a,b,step,m)=>Array.from({length:Math.floor((b-a)/step)+1},(_,i)=>({ms:a+i*step,m}));
const good=[{ms:0,m:30},...range(20,840,20,0.5),{ms:860,m:20},{ms:880,m:28},...range(900,1200,20,9.8),{ms:1230,m:9.8}];
const feed=(trace,rows)=>rows.forEach(s=>assert.equal(trace.add({timestamp:s.ms,magnitude:s.m}),true));

test('a complete catch-like synthetic trace remains evaluable',()=>{
 const trace=createMotionTrace({maxSamples:good.length});feed(trace,good);
 assert.equal(trace.evaluate().ok,true);
});

test('overflow after an otherwise qualifying trace must invalidate its score',()=>{
 const trace=createMotionTrace({maxSamples:good.length});feed(trace,good);
 assert.equal(trace.add({timestamp:1250,magnitude:9.8}),false);
 assert.deepEqual(trace.evaluate(),{ok:false,reason:'motion trace capacity exceeded'});
});

test('reset clears overflow and permits a new full recording',()=>{
 const trace=createMotionTrace({maxSamples:good.length});feed(trace,good);
 trace.add({timestamp:1250,magnitude:9.8});trace.reset();feed(trace,good);
 assert.equal(trace.evaluate().ok,true);
});

test('invalid sample alone does not poison a valid trace',()=>{
 const trace=createMotionTrace({maxSamples:good.length});
 assert.equal(trace.add({timestamp:-1,magnitude:9.8}),false);
 feed(trace,good);assert.equal(trace.evaluate().ok,true);
});
