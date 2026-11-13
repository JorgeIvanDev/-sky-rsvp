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
  motionTrace:[],Math,Number,clearTimeout:()=>{},setTimeout:()=>1,
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
