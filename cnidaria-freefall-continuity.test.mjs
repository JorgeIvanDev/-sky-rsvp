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

test('a renewed low-g segment followed by a later impact is a bounce, not a hand catch',()=>{
 const flight=Array.from({length:42},(_,i)=>({ms:160+i*20,m:0.5}));
 const first=[{ms:1000,m:20},{ms:1020,m:28}];
 const bounce=[{ms:1040,m:9.8},{ms:1060,m:0.5},{ms:1080,m:0.5},{ms:1100,m:0.5},{ms:1120,m:0.5},{ms:1140,m:20}];
 const settle=Array.from({length:15},(_,i)=>({ms:1160+i*20,m:9.8}));
 const result=replayObserved([...start,...flight,...first,...bounce,...settle]);
 assert.equal(result.ok,false);
 assert.match(result.reason,/low-g|impact|spike|settling/);
});

test('post-impact observation cannot infer settling from a sparse tail',()=>{
 const flight=Array.from({length:42},(_,i)=>({ms:160+i*20,m:0.5}));
 const tail=[{ms:1040,m:9.8},{ms:1060,m:9.8},{ms:1080,m:9.8},{ms:1100,m:9.8},{ms:1300,m:9.8},{ms:1360,m:9.8}];
 const result=replayObserved([...start,...flight,...impact,...tail]);
 assert.equal(result.ok,false);
 assert.match(result.reason,/sensor gap|samples|settling/);
});

test('sensor trace cannot treat a 251ms armed interruption as continuous launch',()=>{
 const trace=[{ms:0,m:30},{ms:300,m:0.5},{ms:320,m:0.5},{ms:340,m:0.5},{ms:360,m:0.5},{ms:380,m:0.5},{ms:400,m:0.5},{ms:420,m:0.5},...Array.from({length:25},(_,i)=>({ms:440+i*20,m:0.5})),{ms:960,m:25},{ms:980,m:28}];
 assert.equal(replay(trace).ok,false);
});
