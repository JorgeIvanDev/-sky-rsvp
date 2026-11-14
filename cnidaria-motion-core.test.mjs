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
 assert.equal(replay([...flight,{ms:850,m:18},{ms:866,m:19}]).reason,'invalid sensor sample');
 assert.equal(replay([...flight,{ms:850,m:18},{ms:850,m:19}]).reason,'invalid sensor sample');
});
