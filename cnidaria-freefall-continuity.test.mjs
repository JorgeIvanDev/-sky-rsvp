import test from 'node:test';
import assert from 'node:assert/strict';
import {replay,replayObserved} from './cnidaria-motion-core.mjs';

const start=[{ms:0,m:30},...Array.from({length:7},(_,i)=>({ms:20+i*20,m:0.5}))];
const impact=[{ms:1000,m:20},{ms:1020,m:28}];

test('interleaved gravity and low-g cannot manufacture 250ms freefall',()=>{
 const alternating=Array.from({length:42},(_,i)=>({ms:160+i*20,m:i%2===0?0.5:9.8}));
 const result=replay([...start,...alternating,...impact]);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'premature impact');
});

test('continuous low-g still reaches impact candidate with post-impact settling',()=>{
 const flight=Array.from({length:42},(_,i)=>({ms:160+i*20,m:0.5}));
 const tail=Array.from({length:19},(_,i)=>({ms:1040+i*20,m:9.8}));
 const trace=[...start,...flight,...impact,...tail];
 assert.equal(replay(trace).ok,true);
 const observed=replayObserved(trace);
 assert.equal(observed.ok,true);
 assert.equal(observed.classification,'catch-like only');
});

test('low-g after sensor gaps never contributes missing time',()=>{
 const sparse=[...start,{ms:160,m:0.5},{ms:220,m:0.5},{ms:280,m:0.5},{ms:340,m:0.5},{ms:400,m:0.5},{ms:460,m:0.5},{ms:520,m:0.5},{ms:580,m:0.5},{ms:640,m:0.5},{ms:700,m:0.5},{ms:760,m:0.5},{ms:820,m:0.5},{ms:880,m:0.5},{ms:940,m:0.5},...impact];
 assert.equal(replay(sparse).ok,false);
});
