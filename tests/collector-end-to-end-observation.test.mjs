import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionTrace, replayObserved} from '../cnidaria-motion-core.mjs';

// These are synthetic replay fixtures, not complete user-recorded traces.
const samples=(from,to,step,m)=>Array.from({length:Math.floor((to-from)/step)+1},(_,i)=>({ms:from+i*step,m,spin:0}));
const flight=[{ms:0,m:30},...samples(20,840,20,0.5),{ms:860,m:21},{ms:880,m:25}];
const settled=samples(900,1240,20,9.8);
const feed=points=>{
 const collector=createMotionTrace();
 for(const s of points)assert.equal(collector.add({timestamp:100000+s.ms,magnitude:s.m,spin:s.spin}),true);
 return collector.evaluate();
};

test('complete synthetic catch-like observation is accepted by the actual collector path',()=>{
 const result=feed([...flight,...settled]);
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.classification,'catch-like only');
 assert.equal(result.observationMs,350);
});

test('couch re-impact after apparent settling rejects through collector evaluate',()=>{
 const result=feed([...flight,...samples(900,1080,20,9.8),{ms:1100,m:28},...samples(1120,1240,20,9.8)]);
 assert.equal(result.ok,false,JSON.stringify(result));
});

test('missing post-impact sensor samples reject through collector evaluate',()=>{
 const result=feed([...flight,...samples(900,960,20,9.8),...samples(1080,1240,20,9.8)]);
 assert.equal(result.ok,false,JSON.stringify(result));
 assert.match(result.reason,/gap|observation/i);
});

test('replayed catch-like candidate cannot be credited before 350ms observation closes',()=>{
 const result=feed([...flight,...samples(900,1200,20,9.8)]);
 assert.equal(result.ok,false,JSON.stringify(result));
 assert.equal(result.reason,'incomplete post-impact observation');
});

test('collector reset clears a rejected couch attempt before next candidate',()=>{
 const trace=createMotionTrace();
 const bounce=[...flight,...samples(900,1080,20,9.8),{ms:1100,m:28},...samples(1120,1240,20,9.8)];
 for(const s of bounce)assert.equal(trace.add({timestamp:s.ms,magnitude:s.m,spin:s.spin}),true);
 assert.equal(trace.evaluate().ok,false);
 trace.reset();
 for(const s of [...flight,...settled])assert.equal(trace.add({timestamp:50000+s.ms,magnitude:s.m,spin:s.spin}),true);
 assert.equal(trace.evaluate().ok,true);
});

test('incomplete historical diagnostic excerpts never become fabricated catch evidence',()=>{
 const excerpt=[{ms:7683,m:27,spin:0},{ms:8016,m:24,spin:0},{ms:8033,m:21,spin:0},{ms:8050,m:25,spin:0},{ms:8100,m:0.8,spin:0},{ms:8183,m:0.7,spin:0},{ms:8250,m:26,spin:0}];
 assert.equal(replayObserved(excerpt).ok,false);
});
