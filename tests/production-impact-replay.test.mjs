import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function motion(e){');
const end=html.indexOf('\nasync function submitScore',start);
assert.ok(start>=0&&end>start,'production motion function must exist');
const source=html.slice(start,end);
function replay(readings){
 const elements=new Map();
 const ctx={
  state:'impact-review',lastMotionAt:1000,impactReviewAt:1000,impactReviewFeet:3.03,
  impactReviewSamples:0,impactReboundLowSamples:0,impactReboundDetected:false,
  motionTrace:[],flightFailureReason:'',Math,Number,
  performance:{now:()=>ctx.clock},
  $:id=>{if(!elements.has(id))elements.set(id,{textContent:''});return elements.get(id)},
  complete:(feet,credited)=>{ctx.completed={feet,credited};ctx.state='done'}
 };
 for(const [ms,g] of readings){
  ctx.clock=ms;
  runInNewContext(source+'\nmotion({accelerationIncludingGravity:{x:'+g+',y:0,z:0},rotationRate:null})',ctx);
 }
 return ctx;
}
test('post-impact rebound with two low-g frames and re-impact fails closed',()=>{
 const ctx=replay([[1020,10],[1040,1],[1060,1],[1080,25]]);
 assert.equal(ctx.completed?.credited,false);
 assert.equal(ctx.impactReboundDetected,true);
 assert.match(ctx.flightFailureReason,/Rebound after impact/);
});
test('post-impact sensor gap is rejected even if later readings look settled',()=>{
 const ctx=replay([[1020,10],[1140,10],[1160,10]]);
 assert.equal(ctx.completed?.credited,false);
 assert.match(ctx.flightFailureReason,/Post-impact sensor gap/);
 assert.equal(ctx.impactReviewSamples,1);
});
test('350ms of continuous readings earns only unverified gameplay credit',()=>{
 const readings=Array.from({length:21},(_,i)=>[1000+Math.round((i+1)*350/21),10]);
 const ctx=replay(readings);
 assert.equal(ctx.completed?.credited,true);
 assert.equal(ctx.impactReviewSamples,21);
 assert.equal(ctx.impactReboundDetected,false);
});

test('sparse but uninterrupted post-impact sampling is not sufficient evidence',()=>{
 const ctx=replay([[1080,9.8],[1160,9.8],[1240,9.8],[1320,9.8],[1400,9.8]]);
 assert.equal(ctx.completed?.credited,false);
 assert.equal(ctx.impactReviewSamples,5);
 assert.match(ctx.flightFailureReason,/sample coverage insufficient/);
});
test('exactly 100ms between post-impact frames remains eligible for continued review',()=>{
 const ctx=replay([[1100,9.8],[1200,9.8],[1300,9.8]]);
 assert.equal(ctx.completed,undefined);
 assert.equal(ctx.impactReviewSamples,3);
});
test('one isolated low-g frame followed by impact does not establish a rebound',()=>{
 const ctx=replay([[1020,1],[1040,25],[1060,9.8]]);
 assert.equal(ctx.impactReboundDetected,false);
 assert.equal(ctx.completed,undefined);
});
test('two consecutive low-g readings without a later impact do not by themselves prove a bounce',()=>{
 const ctx=replay([[1020,1],[1040,1],[1060,9.8],[1080,9.8]]);
 assert.equal(ctx.impactReboundDetected,false);
 assert.equal(ctx.completed,undefined);
});
test('post-impact gap of 101ms rejects before counting the delayed reading',()=>{
 const ctx=replay([[1020,9.8],[1121,9.8]]);
 assert.equal(ctx.completed?.credited,false);
 assert.equal(ctx.impactReviewSamples,1);
 assert.match(ctx.flightFailureReason,/Post-impact sensor gap/);
});

test('350ms observation with only seven readings never receives gameplay credit',()=>{
 const readings=Array.from({length:7},(_,i)=>[1000+(i+1)*50,9.8]);
 const ctx=replay(readings);
 assert.equal(ctx.completed?.credited,false);
 assert.equal(ctx.impactReviewSamples,7);
 assert.match(ctx.flightFailureReason,/sample coverage insufficient/);
});
test('eight continuous post-impact readings at 350ms meet the minimum coverage gate',()=>{
 const readings=Array.from({length:8},(_,i)=>[1000+Math.round((i+1)*350/8),9.8]);
 const ctx=replay(readings);
 assert.equal(ctx.completed?.credited,true);
 assert.equal(ctx.impactReviewSamples,8);
 assert.equal(ctx.impactReboundDetected,false);
});
test('re-impact after low-gravity rebound rejects even after initially stable readings',()=>{
 const ctx=replay([[1020,9.8],[1040,9.8],[1060,1.1],[1080,1.3],[1100,26],[1120,9.8]]);
 assert.equal(ctx.completed?.credited,false);
 assert.equal(ctx.impactReboundDetected,true);
 assert.match(ctx.flightFailureReason,/Rebound after impact/);
});
test('gap before first post-impact reading fails closed',()=>{
 const ctx=replay([[1101,9.8],[1120,9.8]]);
 assert.equal(ctx.completed?.credited,false);
 assert.equal(ctx.impactReviewSamples,0);
 assert.match(ctx.flightFailureReason,/Post-impact sensor gap/);
});

test('large hand-like impact spikes alone do not trigger couch rebound rejection',()=>{
 // Synthetic stress sequence, NOT the user's incomplete 21-frame hand trace.
 // High acceleration is possible during a genuine hand catch; only a
 // low-gravity interval followed by re-impact is treated as rebound evidence.
 const magnitudes=[38.91,11.42,18.94,20.65,14.24,16.67,13.63];
 const readings=Array.from({length:21},(_,i)=>[
  1000+Math.round((i+1)*350/21),magnitudes[i%magnitudes.length]
 ]);
 const ctx=replay(readings);
 assert.equal(ctx.impactReviewSamples,21);
 assert.equal(ctx.impactReboundDetected,false);
 assert.equal(ctx.completed?.credited,true,
  'sufficient impact-review coverage earns only unverified gameplay credit');
 assert.match(ctx.flightFailureReason,/hand catch cannot be verified/);
});
test('two isolated near-weightless samples separated by gravity never become a rebound',()=>{
 const readings=[[1020,1],[1040,9.8],[1060,1],[1080,25],
  [1100,9.8],[1120,9.8],[1140,9.8],[1160,9.8]];
 const ctx=replay(readings);
 assert.equal(ctx.impactReboundDetected,false);
 assert.equal(ctx.completed,undefined);
});
