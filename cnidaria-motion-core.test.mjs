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
test('invalid observation settings fail closed',async()=>{const {replayObserved}=await import('./cnidaria-motion-core.mjs');for(const options of [{observationMs:349},{observationMs:NaN},{maxGapMs:0},{maxGapMs:Infinity},{minPostSamples:7},{minPostSamples:8.5}])assert.equal(replayObserved([],options).reason,'invalid observation settings')});

test('separated high-g couch bounce is not a catch even without sustained low-g',async()=>{
 const {replayObserved}=await import('./cnidaria-motion-core.mjs');
 const base=[...flight,{ms:866,m:18},{ms:882,m:160}];
 const tail=[...seq(898,1058,16,9.8),{ms:1074,m:24},...seq(1090,1250,16,9.8)];
 const result=replayObserved([...base,...tail]);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'separated post-impact spike');
});
test('nearby high-g samples remain one impact cluster, not an invented bounce',async()=>{
 const {replayObserved}=await import('./cnidaria-motion-core.mjs');
 const base=[...flight,{ms:866,m:18},{ms:882,m:160},{ms:914,m:19},...seq(930,1250,16,9.8)];
 assert.equal(replayObserved(base).ok,true);
});

test('collector rejects null, undefined and non-object sensor events without crashing',()=>{const c=createMotionTrace();for(const value of [null,undefined,0,'bad',[],{}]){assert.equal(c.add(value),false);assert.equal(c.samples.length,0)}assert.equal(c.add({timestamp:100,magnitude:9.8}),true);assert.equal(c.samples[0].ms,0)});


test('launch requires consecutive low-g readings, not a sparse 100ms jump',()=>{
 const sparse=[{ms:0,m:30},{ms:20,m:.5},{ms:120,m:.5},...seq(140,840,20,.5),{ms:860,m:20},{ms:880,m:30}];
 // A later genuine contiguous low-g window may launch; the original 20ms sample cannot be its start.
 const continuous=[{ms:0,m:30},...seq(20,840,20,.5),{ms:860,m:20},{ms:880,m:30}];
 assert.equal(replay(continuous).ok,true);
 assert.equal(replay(sparse).ok,true);
 const broken=[{ms:0,m:30},{ms:20,m:.5},{ms:120,m:.5},{ms:140,m:9.8},{ms:160,m:.5},{ms:180,m:9.8},{ms:200,m:.5},{ms:220,m:9.8},{ms:240,m:.5},{ms:260,m:9.8},{ms:280,m:.5},{ms:300,m:9.8},{ms:320,m:.5},{ms:340,m:9.8},{ms:360,m:.5},{ms:380,m:9.8},{ms:400,m:.5},{ms:420,m:9.8},{ms:440,m:.5},{ms:460,m:9.8},{ms:480,m:.5},{ms:500,m:9.8},{ms:520,m:.5},{ms:540,m:9.8},{ms:560,m:.5},{ms:580,m:9.8},{ms:600,m:.5},{ms:620,m:9.8},{ms:640,m:.5},{ms:660,m:9.8},{ms:680,m:.5},{ms:700,m:9.8},{ms:720,m:.5},{ms:740,m:9.8},{ms:760,m:.5},{ms:780,m:9.8},{ms:800,m:.5},{ms:820,m:9.8},{ms:840,m:.5},{ms:860,m:20},{ms:880,m:30}];
 assert.equal(replay(broken).ok,false);
});

test('armed launch window cannot bridge a pre-flight sensor interruption',()=>{
 const interrupted=[{ms:0,m:30},{ms:20,m:.5},{ms:40,m:.5},{ms:400,m:.5},{ms:420,m:.5},{ms:440,m:.5},{ms:460,m:.5},{ms:480,m:.5},{ms:500,m:.5},{ms:520,m:.5},{ms:540,m:.5},{ms:560,m:.5},{ms:580,m:.5},{ms:600,m:.5},{ms:620,m:.5},{ms:640,m:.5},{ms:660,m:.5},{ms:680,m:.5},{ms:700,m:.5},{ms:720,m:.5},{ms:740,m:.5},{ms:760,m:.5},{ms:780,m:.5},{ms:800,m:.5},{ms:820,m:.5},{ms:840,m:.5},{ms:860,m:22},{ms:880,m:28}];
 assert.equal(replay(interrupted).ok,false,'old launch impulse cannot arm a delayed freefall');
 const resumed=[...interrupted.slice(0,4),{ms:416,m:30},...seq(432,850,16,.5),{ms:866,m:18},{ms:882,m:160}];
 assert.equal(replay(resumed).ok,true,'a fresh impulse can still start a flight');
});

test('observed catch-like result fails on missing flight samples before impact',async()=>{
 const {replayObserved}=await import('./cnidaria-motion-core.mjs');
 const sparse=[...flight.filter(s=>s.ms<400||s.ms>560),{ms:866,m:18},{ms:882,m:160},...seq(898,1250,16,9.8)];
 assert.equal(replayObserved(sparse).reason,'pre-impact sensor gap');
 const complete=[...flight,{ms:866,m:18},{ms:882,m:160},...seq(898,1250,16,9.8)];
 assert.equal(replayObserved(complete).ok,true);
});
test('a single low-g sample after impact is not a fabricated 48ms freefall run',async()=>{
 const {replayObserved}=await import('./cnidaria-motion-core.mjs');
 const base=[...flight,{ms:866,m:18},{ms:882,m:160}];
 const tail=[{ms:930,m:.5},...seq(946,1250,16,9.8)];
 assert.equal(replayObserved([...base,...tail]).ok,true);
 const consecutive=[...base,{ms:898,m:.5},{ms:914,m:.5},{ms:930,m:.5},{ms:946,m:.5},...seq(962,1250,16,9.8)];
 assert.equal(replayObserved(consecutive).reason,'renewed low-g after impact');
});

 
// Timings are anchored to the two user-labeled 2026-11-11 sessions.
// The full raw recordings are not available in this repository: these are
// synthetic boundary replays, NOT evidence that either real trace passes.
test('2026-11-11 labeled couch-drop timing: 8016ms re-impact invalidates first impact at 7683ms',async()=>{
 const {replayObserved}=await import('./cnidaria-motion-core.mjs');
 const low=seq(7000,7660,20,.5);
 const first=[{ms:6900,m:30},...low,{ms:7683,m:21},{ms:7703,m:24}];
 const settled=seq(7723,8003,20,9.8);
 const bounce=[{ms:8016,m:24},{ms:8036,m:22},{ms:8050,m:23},{ms:8070,m:9.8},...seq(8100,8180,20,.5),{ms:8250,m:24},...seq(8270,8370,20,9.8)];
 const result=replayObserved([...first,...settled,...bounce]);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'separated post-impact spike');
});
test('2026-11-11 labeled hand-catch sampling pattern: 21 observations over 350ms can complete review',async()=>{
 const {replayObserved}=await import('./cnidaria-motion-core.mjs');
 const pre=[{ms:0,m:30},...seq(100,700,20,.5),{ms:720,m:21},{ms:740,m:24}];
 const post=seq(760,1120,18,9.8);
 assert.equal(post.length,21);
 const result=replayObserved([...pre,...post]);
 assert.equal(result.ok,true);
 assert.equal(result.classification,'catch-like only');
 assert.equal(replayObserved([...pre,...post.slice(0,-3)]).reason,'incomplete post-impact observation');
});


test('post-impact low-g requires contiguous samples, not a fabricated 50ms run across a 100ms interval',async()=>{
 const {replayObserved}=await import('./cnidaria-motion-core.mjs');
 const base=[...flight,{ms:866,m:18},{ms:882,m:160}];
 const sparse=[...base,...seq(898,978,16,9.8),{ms:994,m:.5},{ms:1094,m:.5},...seq(1110,1250,16,9.8)];
 assert.equal(replayObserved(sparse,{maxGapMs:100}).ok,true);
 const continuous=[...base,...seq(898,978,16,9.8),{ms:994,m:.5},{ms:1010,m:.5},{ms:1026,m:.5},{ms:1042,m:.5},...seq(1058,1250,16,9.8)];
 assert.equal(replayObserved(continuous).reason,'renewed low-g after impact');
});


test('shared observed replay requires eight post-impact samples even when timing gaps are permitted',async()=>{
 const {replayObserved}=await import('./cnidaria-motion-core.mjs');
 const base=[...flight,{ms:866,m:18},{ms:882,m:160}];
 const sparse=[...base,{ms:950,m:9.8},{ms:1020,m:9.8},{ms:1090,m:9.8},{ms:1160,m:9.8},{ms:1230,m:9.8}];
 assert.equal(replayObserved(sparse).reason,'insufficient post-impact samples');
 const dense=[...base,...seq(898,1250,16,9.8)];
 assert.equal(replayObserved(dense).ok,true);
});

test('impact trigger does not count toward eight required post-impact observations',async()=>{
 const {replayObserved}=await import('./cnidaria-motion-core.mjs');
 const base=[...flight,{ms:866,m:18},{ms:882,m:160}];
 const seven=[932,988,1044,1100,1156,1212,1250].map(ms=>({ms,m:9.8,spin:0}));
 const insufficient=replayObserved([...base,...seven]);
 assert.equal(insufficient.reason,'insufficient post-impact samples');
 const eight=[{ms:898,m:9.8,spin:0},...seven];
 assert.equal(replayObserved([...base,...eight]).ok,true);
 assert.equal(replayObserved([...base,...eight]).classification,'catch-like only');
});


test('continuous post-impact tumbling cannot masquerade as a settled catch',async()=>{
 const {replayObserved}=await import('./cnidaria-motion-core.mjs');
 const base=[...flight,{ms:866,m:18},{ms:882,m:160}];
 const tumbling=[...base,...seq(898,1250,16,15)];
 const result=replayObserved(tumbling);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'no stable post-impact settling');
 const settled=[...base,...seq(898,1090,16,15),...seq(1106,1250,16,9.8)];
 assert.equal(replayObserved(settled).classification,'catch-like only');
});
test('isolated settling sample does not establish stable post-impact observation',async()=>{
 const {replayObserved}=await import('./cnidaria-motion-core.mjs');
 const base=[...flight,{ms:866,m:18},{ms:882,m:160}];
 const tail=seq(898,1250,16,15).map(s=>s.ms===1218?{...s,m:9.8}:s);
 assert.equal(replayObserved([...base,...tail]).reason,'no stable post-impact settling');
});


test('observed replay does not invent flight from separated low-g readings',async()=>{
 const {replayObserved}=await import('./cnidaria-motion-core.mjs');
 const samples=[{ms:0,m:30},{ms:20,m:.5},{ms:140,m:.5},{ms:160,m:9.8},...seq(180,780,20,.5),{ms:800,m:20},{ms:820,m:30},...seq(840,1200,20,9.8)];
 // A fresh contiguous window can still establish a valid candidate.
 assert.equal(replayObserved(samples).ok,true);
 const broken=[{ms:0,m:30},{ms:20,m:.5},{ms:140,m:.5},...seq(160,780,20,9.8).map((s,i)=>({...s,m:i%2?.5:9.8})),{ms:800,m:20},{ms:820,m:30},...seq(840,1200,20,9.8)];
 assert.equal(replayObserved(broken).ok,false);
});
