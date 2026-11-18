import test from 'node:test';
import assert from 'node:assert/strict';
import {replay, replayObserved} from './cnidaria-motion-core.mjs';

// Synthetic boundary trace, not a user-recorded physical catch.
const range=(start,end,step,m)=>Array.from({length:Math.floor((end-start)/step)+1},(_,i)=>({ms:start+i*step,m}));
const flight=[{ms:0,m:30},...range(20,840,20,0.5)];
const landing=[{ms:860,m:20},{ms:880,m:28},...range(900,1200,20,9.8),{ms:1230,m:9.8}];

test('early flight jolt does not start the 350ms landing observation',()=>{
 const baseline=[...flight,...landing];
 const withEarlyJolt=[...flight.map(s=>s.ms===200?{...s,m:22}:s),...landing];
 assert.equal(replay(baseline).ok,true);
 assert.equal(replay(withEarlyJolt).ok,true,'early flight spike must not become an eligible catch');
 const result=replayObserved(withEarlyJolt);
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.observationMs,350);
 assert.equal(result.classification,'catch-like only');
});

test('early flight jolt alone is not a landing or a catch',()=>{
 const withoutLanding=[...flight.map(s=>s.ms===200?{...s,m:22}:s),...range(860,1240,20,9.8)];
 assert.equal(replayObserved(withoutLanding).ok,false);
});
