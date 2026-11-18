import test from 'node:test';
import assert from 'node:assert/strict';
import {replayObserved, createMotionTrace} from './cnidaria-motion-core.mjs';

// Synthetic boundary cases informed by the two November 11 user labels.
// These are not the original phone sensor recordings and cannot validate them.
const range=(from,to,step,m)=>Array.from({length:Math.floor((to-from)/step)+1},(_,i)=>({ms:from+i*step,m,spin:0}));
const launch=[{ms:0,m:30},...range(20,840,20,.5),{ms:860,m:21},{ms:880,m:25}];
const settle=range(900,1240,20,9.8);

test('three separated couch re-impacts reject even when the phone settles afterward',()=>{
 const samples=[...launch,...range(900,980,20,9.8),
  {ms:1000,m:28},...range(1020,1080,20,9.8),
  {ms:1100,m:23},...range(1120,1180,20,9.8),
  {ms:1200,m:25},{ms:1220,m:9.8},{ms:1240,m:9.8}];
 const result=replayObserved(samples);
 assert.equal(result.ok,false);
 assert.match(result.reason,/impact|spike|freefall|settling/i);
});

test('a clean 350ms observed trajectory remains catch-like, never verified hand catch',()=>{
 const result=replayObserved([...launch,...settle]);
 assert.equal(result.ok,true);
 assert.equal(result.classification,'catch-like only');
 assert.equal(result.observationMs,350);
});

test('an incomplete 350ms observation cannot be rescued by high spin',()=>{
 const samples=[...launch,...range(900,1160,20,9.8)].map(s=>({...s,spin:10000}));
 const result=replayObserved(samples);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'incomplete post-impact observation');
});

test('collector accepts fractional browser origin and rejects rounded duplicate milliseconds',()=>{
 const trace=createMotionTrace();
 assert.equal(trace.add({timestamp:1000.1,magnitude:9.8}),true);
 assert.equal(trace.add({timestamp:1000,magnitude:9.8}),false);
 assert.equal(trace.add({timestamp:1000.4,magnitude:9.8}),false);
 assert.equal(trace.add({timestamp:1000,magnitude:9.8}),false);
 assert.equal(trace.add({timestamp:1001,magnitude:9.8}),true);
 assert.deepEqual(trace.samples.map(s=>s.ms),[0,1]);
});

test('collector reset clears timestamps and prevents a prior attempt contaminating retry',()=>{
 const trace=createMotionTrace();
 for(const s of [...launch,...settle])assert.equal(trace.add({timestamp:s.ms,magnitude:s.m,spin:s.spin}),true);
 assert.equal(trace.evaluate().ok,true);
 trace.reset();
 assert.equal(trace.samples.length,0);
 assert.equal(trace.evaluate().ok,false);
 assert.equal(trace.add({timestamp:50000,magnitude:9.8}),true);
 assert.deepEqual(trace.samples.map(s=>s.ms),[0]);
});

test('late couch re-impact at 330ms cannot be mistaken for terminal settling',()=>{
 const samples=[...launch,...range(900,1180,20,9.8),
  {ms:1200,m:27},{ms:1220,m:9.8},{ms:1240,m:9.8}];
 const result=replayObserved(samples);
 assert.equal(result.ok,false);
 assert.match(result.reason,/impact|spike|settling|unstable/i);
});

test('renewed post-impact freefall followed by re-impact rejects despite final gravity readings',()=>{
 const samples=[...launch,...range(900,980,20,9.8),
  ...range(1000,1080,20,0.7),{ms:1100,m:28},
  ...range(1120,1240,20,9.8)];
 const result=replayObserved(samples);
 assert.equal(result.ok,false);
 assert.match(result.reason,/impact|spike|freefall|low-g/i);
});
