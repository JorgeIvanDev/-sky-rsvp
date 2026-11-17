import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../direct-challenge.html',import.meta.url),'utf8');
const start=html.indexOf("$('enable-motion').onclick=()=>run(async()=>{");
const end=html.indexOf("\n$('start-motion').onclick",start);
assert.ok(start>=0&&end>start,'production permission handler must be extractable');
const handler=html.slice(start,end);

test('repeated permission taps install only one device motion listener',async()=>{
  let requests=0,listeners=0;
  const nodes=new Map();
  const $=id=>{if(!nodes.has(id))nodes.set(id,{disabled:true,textContent:''});return nodes.get(id)};
  const ctx={
    $,motionEnabled:false,motionHandler:()=>{},
    DeviceMotionEvent:{requestPermission:async()=>{requests++;return 'granted'}},
    window:{addEventListener:(name)=>{assert.equal(name,'devicemotion');listeners++}},
    run:fn=>Promise.resolve().then(fn),
    Error
  };
  // The production handler closes over motionEnabled; expose the variable in the same VM.
  runInNewContext('let motionEnabled=false;'+handler+';globalThis.enable=()=>$(\'enable-motion\').onclick()',ctx);
  await ctx.enable();
  await ctx.enable();
  assert.equal(requests,1);
  assert.equal(listeners,1);
  assert.equal(nodes.get('start-motion').disabled,false);
  assert.match(nodes.get('motion-status').textContent,/already enabled/);
});

test('denied permission does not attach a listener and permits retry',async()=>{
  let requests=0,listeners=0;
  const nodes=new Map();
  const $=id=>{if(!nodes.has(id))nodes.set(id,{disabled:true,textContent:''});return nodes.get(id)};
  const ctx={
    $,motionHandler:()=>{},
    DeviceMotionEvent:{requestPermission:async()=>{requests++;return requests===1?'denied':'granted'}},
    window:{addEventListener:()=>{listeners++}},
    run:fn=>Promise.resolve().then(fn),
    Error
  };
  runInNewContext('let motionEnabled=false;'+handler+';globalThis.enable=()=>$(\'enable-motion\').onclick()',ctx);
  await assert.rejects(ctx.enable(),/permission not granted/);
  assert.equal(listeners,0);
  await ctx.enable();
  assert.equal(listeners,1);
  assert.equal(requests,2);
});

test('background interruption discards an active trace and requires a fresh start',()=>{
 const begin=html.indexOf('function cancelBackgroundMotion(){');
 const end=html.indexOf("\nif(session){run(refresh)",begin);
 assert.ok(begin>=0&&end>begin,'production background cancellation must be present');
 const source=html.slice(begin,end);
 const nodes=new Map();
 const $=id=>{if(!nodes.has(id))nodes.set(id,{disabled:false,textContent:''});return nodes.get(id)};
 let resets=0;const handlers={};
 const context={
   $,motionTrace:{reset:()=>{resets++}},
   document:{visibilityState:'visible',addEventListener:(name,fn)=>{handlers[name]=fn}},
   window:{addEventListener:(name,fn)=>{handlers[name]=fn}}
 };
 runInNewContext('let motionActive=true,motionEnabled=true,motionSamples=17,motionPeak=19;'+source+';globalThis.snapshot=()=>({motionActive,motionSamples,motionPeak})',context);
 context.document.visibilityState='hidden';handlers.visibilitychange();
 assert.equal(resets,1);
 assert.equal(context.snapshot().motionActive,false);
 assert.equal(context.snapshot().motionSamples,0);
 assert.equal(nodes.get('stop-motion').disabled,true);
 assert.equal(nodes.get('start-motion').disabled,false);
 assert.match(nodes.get('motion-status').textContent,/no score was submitted/);
 handlers.pagehide();assert.equal(resets,1,'second background event must be idempotent');
});
