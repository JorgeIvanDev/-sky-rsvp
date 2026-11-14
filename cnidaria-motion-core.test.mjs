import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {replay,createMotionTrace} from './cnidaria-motion-core.mjs';
const seq=(start,end,step,m)=>Array.from({length:Math.floor((end-start)/step)+1},(_,i)=>({ms:start+i*step,m,spin:100}));
const flight=[{ms:0,m:30},...seq(50,180,16,.5),...seq(196,850,16,.3)];
test('shared engine preserves strong and gentle catch-like detection',()=>{assert.equal(replay([...flight,{ms:866,m:17.84},{ms:882,m:160.2}]).mode,'strong');assert.equal(replay([...flight,{ms:866,m:18},{ms:882,m:9.8},{ms:898,m:9.7},{ms:914,m:9.9}]).mode,'gentle')});
test('shared engine rejects incomplete/no-launch and sensor gaps',()=>{assert.equal(replay([...seq(0,900,16,.3),{ms:916,m:22}]).ok,false);assert.equal(replay([...flight.slice(0,12),{ms:600,m:.4}]).ok,false)});
test('trace collector rejects malformed/out-of-order samples and supports reset',()=>{const c=createMotionTrace({maxSamples:2});assert.equal(c.add({timestamp:100,magnitude:9.8}),true);assert.equal(c.add({timestamp:100,magnitude:8}),false);assert.equal(c.add({timestamp:120,magnitude:9.7}),true);assert.equal(c.add({timestamp:130,magnitude:9}),false);c.reset();assert.equal(c.samples.length,0);assert.equal(c.evaluate().ok,false)});
test('gauntlet imports shared replay but does not automatically submit diagnostic results',()=>{const html=fs.readFileSync(new URL('./direct-challenge.html',import.meta.url),'utf8');assert.match(html,/import \{createMotionTrace\}/);assert.match(html,/motionTrace\.evaluate\(\)/);assert.match(html,/This does not submit a score/)});

test('shared replay fails closed on malformed and out-of-order sensor data',()=>{
 const valid=[...flight,{ms:866,m:17.84},{ms:882,m:160.2}];
 assert.equal(replay(valid).mode,'strong');
 for(const sample of [{ms:NaN,m:9.8},{ms:866,m:Infinity},{ms:866,m:-1},{ms:866,m:9.8,spin:NaN},{ms:-1,m:9.8}]){
  assert.equal(replay([...flight,sample,{ms:882,m:160.2}]).ok,false);
 }
 assert.equal(replay([...flight,{ms:836,m:18},{ms:866,m:19}]).reason,'invalid sensor sample');
 assert.equal(replay([...flight,{ms:850,m:18},{ms:850,m:19}]).reason,'invalid sensor sample');
 assert.equal(replay([...valid,{ms:882,m:10}]).reason,'invalid sensor sample');
 assert.equal(replay([...valid,{ms:900,m:NaN}]).reason,'invalid sensor sample');
});

test('invalid samples after a successful-looking catch never produce a score',()=>{const valid=[...flight,{ms:866,m:17.84},{ms:882,m:160.2}];for(const extra of [{ms:899,m:-.1},{ms:899,m:Infinity},{ms:882,m:1},{ms:900,m:1,spin:NaN}]){const r=replay([...valid,extra]);assert.equal(r.ok,false);assert.equal(r.reason,'invalid sensor sample')}});
test('trace collector refuses bad timestamps and spin never creates a scored toss',()=>{const c=createMotionTrace();assert.equal(c.add({timestamp:100,magnitude:10}),true);assert.equal(c.add({timestamp:NaN,magnitude:10}),false);assert.equal(c.add({timestamp:90,magnitude:10}),false);assert.equal(c.add({timestamp:116,magnitude:-2}),false);assert.equal(c.evaluate().ok,false)});

test('observed scoring waits for 350ms and rejects couch re-impact',async()=>{
 const {replayObserved}=await import('./cnidaria-motion-core.mjs');
 const base=[...flight,{ms:866,m:18},{ms:882,m:160}];
 assert.equal(replayObserved(base).ok,false);
 assert.equal(replayObserved(base).reason,'incomplete post-impact observation');
 const settled=[...base,...seq(898,1250,16,9.8)];
 assert.equal(replayObserved(settled).ok,true);
 assert.equal(replayObserved([...base,...seq(898,994,16,9.8),...seq(1010,1090,16,.5),{ms:1106,m:26},...seq(1122,1250,16,9.8)]).ok,false);
 assert.equal(replayObserved([...base,{ms:1100,m:9.8},{ms:1250,m:9.8}]).reason,'post-impact sensor gap');
});

test('post-impact observation accepts the first sample after a deadline',async()=>{const {replayObserved}=await import('./cnidaria-motion-core.mjs');const base=[...flight,{ms:866,m:18},{ms:882,m:160}];const tail=seq(898,1250,16,9.8);assert.equal(replayObserved([...base,...tail]).ok,true);const exactly=[...base,...seq(898,1202,16,9.8),{ms:1216,m:9.8}];assert.equal(replayObserved(exactly).ok,true);assert.equal(replayObserved([...base,...seq(898,1202,16,9.8)]).reason,'incomplete post-impact observation')});
test('post-impact gaps and renewed freefall remain disqualifying',async()=>{const {replayObserved}=await import('./cnidaria-motion-core.mjs');const base=[...flight,{ms:866,m:18},{ms:882,m:160}];assert.equal(replayObserved([...base,{ms:1100,m:9.8},{ms:1250,m:9.8}]).reason,'post-impact sensor gap');assert.equal(replayObserved([...base,...seq(898,994,16,9.8),...seq(1010,1090,16,.5),{ms:1106,m:26},...seq(1122,1250,16,9.8)]).ok,false)});

test('motion collector rejects invalid capacity and spin without corrupting state',()=>{for(const maxSamples of [0,-1,1.5,Infinity,100001])assert.throws(()=>createMotionTrace({maxSamples}));const c=createMotionTrace();assert.equal(c.add({timestamp:100,magnitude:9.8,spin:Infinity}),false);assert.equal(c.samples.length,0);assert.equal(c.add({timestamp:101,magnitude:9.8,spin:0}),true);assert.equal(c.samples[0].ms,0)});
test('invalid observation settings fail closed',async()=>{const {replayObserved}=await import('./cnidaria-motion-core.mjs');for(const options of [{observationMs:349},{observationMs:NaN},{maxGapMs:0},{maxGapMs:Infinity}])assert.equal(replayObserved([],options).reason,'invalid observation settings')});
