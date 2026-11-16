import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionTrace, replay, replayObserved } from './cnidaria-motion-core.mjs';

const seq=(start,end,step,m)=>Array.from({length:Math.floor((end-start)/step)+1},(_,i)=>({ms:start+i*step,m,spin:0}));
const base=[{ms:0,m:30},...seq(50,850,16,.5),{ms:866,m:18},{ms:882,m:160}];

test('collector rejects duplicate and rounded-to-duplicate timestamps without changing trace',()=>{
 const trace=createMotionTrace();
 assert.equal(trace.add({timestamp:1000,magnitude:30}),true);
 assert.equal(trace.add({timestamp:1000.1,magnitude:9.8}),false);
 assert.equal(trace.add({timestamp:1000.49,magnitude:9.8}),false);
 assert.equal(trace.samples.length,1);
 assert.equal(trace.add({timestamp:1001,magnitude:9.8}),true);
 assert.deepEqual(trace.samples.map(s=>s.ms),[0,1]);
});

test('collector rejects a nonfinite relative timestamp and remains usable',()=>{
 const trace=createMotionTrace();
 assert.equal(trace.add({timestamp:1e308,magnitude:9.8}),true);
 assert.equal(trace.add({timestamp:1.7e308,magnitude:9.8}),false);
 assert.equal(trace.samples.length,1);
 trace.reset();
 assert.equal(trace.add({timestamp:100,magnitude:9.8}),true);
 assert.equal(trace.samples[0].ms,0);
});

test('replay rejects duplicated timestamps even if first event looked catch-like',()=>{
 const valid=[...base];
 assert.equal(replay(valid).ok,true);
 const duplicated=[...valid,{ms:882,m:9.8}];
 assert.equal(replay(duplicated).reason,'invalid sensor sample');
 assert.equal(replayObserved(duplicated).reason,'invalid sensor sample');
});

test('350ms observation cannot be completed by duplicate closing frames',()=>{
 const trace=[...base,...seq(898,1202,16,9.8)];
 assert.equal(replayObserved(trace).reason,'incomplete post-impact observation');
 assert.equal(replayObserved([...trace,{ms:1202,m:9.8}]).reason,'invalid sensor sample');
 assert.equal(replayObserved([...trace,{ms:1216,m:9.8}]).ok,true);
});
