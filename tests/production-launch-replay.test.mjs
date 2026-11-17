import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function motion(e){');
const end=html.indexOf('\nasync function submitScore',start);
assert.ok(start>=0&&end>start,'production motion source available');
const source=html.slice(start,end);
function run(readings){
 const nodes=new Map();
 const ctx={state:'armed',lastMotionAt:0,lastLaunchImpulse:0,lowStart:0,
  motionTrace:[],G:9.80665,FT:3.28084,spinPeak:0,flightPeak:0,flightSamples:0,flightStart:0,freefallMs:0,freefallLastAt:0,airborneLostAt:0,impactCount:0,impactStartedAt:0,firstImpactFeet:0,gentleSettleSamples:0,strongImpactAt:0,strongFirstFeet:0,flightFailureReason:'No confirmed catch',flightWatchdog:0,flightReboundAnchor:0,flightReboundAt:0,flightReboundLowSamples:0,Math,Number,clearTimeout:()=>{},setTimeout:()=>1,
  performance:{now:()=>ctx.clock},
  $:id=>{if(!nodes.has(id))nodes.set(id,{textContent:''});return nodes.get(id)},
  complete:()=>{ctx.state='done'}};
 for(const [ms,g] of readings){
  ctx.clock=ms;
  runInNewContext(source+'\nmotion({accelerationIncludingGravity:{x:'+g+',y:0,z:0},rotationRate:null})',ctx);
 }
 return ctx;
}
test('stationary near-weightlessness without a launch impulse never starts flight',()=>{
 const ctx=run([[1000,1],[1040,1],[1080,1],[1120,1],[1160,1]]);
 assert.equal(ctx.state,'armed');
});
test('stale launch impulse across a sensor pause cannot arm flight',()=>{
 const ctx=run([[1000,20],[1030,1],[1250,1],[1290,1],[1330,1],[1370,1]]);
 assert.equal(ctx.state,'armed');
 assert.equal(ctx.lastLaunchImpulse,0);
});
test('continuous low gravity after a recent impulse starts flight',()=>{
 const ctx=run([[1000,20],[1020,1],[1060,1],[1100,1],[1140,1]]);
 assert.equal(ctx.state,'flying');
 assert.equal(ctx.flightStart,1020);
});
test('sensor gap during launch low gravity resets continuity',()=>{
 const ctx=run([[1000,20],[1020,1],[1210,1],[1250,1],[1290,1]]);
 assert.equal(ctx.state,'armed');
});

test('armed launch cannot accumulate 100ms of low gravity across a 90ms sensor gap',()=>{
 const ctx=run([[1000,20],[1020,1],[1110,1],[1130,1],[1150,1],[1170,1]]);
 assert.equal(ctx.state,'armed');
 const fresh=run([[1000,20],[1020,1],[1110,1],[1130,1],[1150,1],[1170,1],[1190,1],[1210,1]]);
 assert.equal(fresh.state,'flying');
 assert.equal(fresh.flightStart,1110);
});

test('out-of-order sensor timestamps cannot rewind launch arming or enter trace',()=>{
 const ctx=run([[1000,20],[1020,1],[1010,1],[1060,1],[1100,1],[1140,1]]);
 assert.equal(ctx.state,'flying');
 assert.equal(ctx.flightStart,1020);
 assert.equal(ctx.motionTrace.length,5);
});
test('nonfinite and negative clocks do not poison launch or traces',()=>{
 const ctx=run([[1000,20],[Number.NaN,1],[-20,1],[Number.POSITIVE_INFINITY,1],[1020,1],[1060,1],[1100,1],[1140,1]]);
 assert.equal(ctx.state,'flying');
 assert.equal(ctx.motionTrace.length,5);
 assert.equal(ctx.flightStart,1020);
});

test('early couch rebound within 100ms of impact is rejected before another catch',()=>{
 const launch=[[1000,20],[1020,1],[1060,1],[1100,1],[1140,1]];
 const flight=Array.from({length:7},(_,i)=>[1180+i*40,1]);
 const ctx=run([...launch,...flight,[1460,24],[1480,1],[1500,1],[1540,25]]);
 assert.equal(ctx.state,'done');
 assert.match(ctx.flightFailureReason,/Repeated airborne impact after rebound/);
});
test('single low-g frame after impact does not establish a couch rebound',()=>{
 const launch=[[1000,20],[1020,1],[1060,1],[1100,1],[1140,1]];
 const flight=Array.from({length:7},(_,i)=>[1180+i*40,1]);
 const ctx=run([...launch,...flight,[1460,24],[1480,1],[1500,9.8],[1540,25]]);
 assert.doesNotMatch(ctx.flightFailureReason||'',/Repeated airborne impact after rebound/);
});

test('flight rebound evidence cannot bridge a 60ms sensor interruption',()=>{
 const launch=[[1000,20],[1020,1],[1060,1],[1100,1],[1140,1]];
 const flight=Array.from({length:7},(_,i)=>[1180+i*40,1]);
 const ctx=run([...launch,...flight,[1460,24],[1480,1],[1540,1],[1580,25]]);
 assert.doesNotMatch(ctx.flightFailureReason||'',/Repeated airborne impact after rebound/);
 assert.equal(ctx.flightReboundLowSamples,0);
});
test('adjacent airborne low-g frames still reject a genuine re-impact pattern',()=>{
 const launch=[[1000,20],[1020,1],[1060,1],[1100,1],[1140,1]];
 const flight=Array.from({length:7},(_,i)=>[1180+i*40,1]);
 const ctx=run([...launch,...flight,[1460,24],[1480,1],[1520,1],[1560,25]]);
 assert.equal(ctx.state,'done');
 assert.match(ctx.flightFailureReason,/Repeated airborne impact after rebound/);
});

test('missing airborne sensor intervals cannot count toward sustained freefall',()=>{
 const launch=[[1000,20],[1020,1],[1060,1],[1100,1],[1140,1]];
 const ctx=run([...launch,[1180,1],[1240,1],[1280,1]]);
 assert.equal(ctx.state,'flying');
 assert.equal(ctx.freefallMs,80,'40ms + 40ms observed; 60ms missing interval earns no credit');
 assert.equal(ctx.flightReboundLowSamples,0);
});
test('continuous airborne readings still accumulate real freefall duration',()=>{
 const launch=[[1000,20],[1020,1],[1060,1],[1100,1],[1140,1]];
 const ctx=run([...launch,[1180,1],[1220,1],[1260,1]]);
 assert.equal(ctx.state,'flying');
 assert.equal(ctx.freefallMs,120);
});
