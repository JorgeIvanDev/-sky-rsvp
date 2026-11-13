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
