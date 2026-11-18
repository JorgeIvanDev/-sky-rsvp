import test from 'node:test';
import assert from 'node:assert/strict';
import {replayObserved} from './cnidaria-motion-core.mjs';

// Synthetic traces only: no claim of reproducing a user-recorded hand catch.
const range=(a,b,step,m)=>Array.from({length:Math.floor((b-a)/step)+1},(_,i)=>({ms:a+i*step,m}));
const pre=[{ms:0,m:30},...range(20,840,20,0.5),{ms:860,m:20},{ms:880,m:28}];

test('350ms observation accepts normal closing-frame jitter',()=>{
 const trace=[...pre,...range(900,1200,20,9.8),{ms:1230,m:9.8}];
 const result=replayObserved(trace);
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.classification,'catch-like only');
});

test('sensor pause beyond 100ms after 350ms deadline fails closed',()=>{
 const trace=[...pre,...range(900,1200,20,9.8),{ms:1500,m:9.8}];
 const result=replayObserved(trace);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'post-impact observation timeout');
});

test('a missing closing sample cannot be counted as complete observation',()=>{
 const result=replayObserved([...pre,...range(900,1200,20,9.8)]);
 assert.equal(result.reason,'incomplete post-impact observation');
});

test('a couch re-impact still fails even with a timely closing frame',()=>{
 const trace=[...pre,...range(900,1040,20,9.8),{ms:1060,m:24},...range(1080,1200,20,9.8),{ms:1230,m:9.8}];
 const result=replayObserved(trace);
 assert.equal(result.ok,false);
 assert.match(result.reason,/spike|impact|low-g/);
});
