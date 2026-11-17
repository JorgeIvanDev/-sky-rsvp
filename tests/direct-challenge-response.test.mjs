import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../direct-challenge.html',import.meta.url),'utf8');
const start=html.indexOf('async function respond(accept){');
const end=html.indexOf("\n$('submit-toss').onclick",start);
assert.ok(start>=0&&end>start,'production response handler must be extractable');
const code=html.slice(start,end);

async function exercise(payload,accept=true,refreshError=null){
  const elements=new Map();
  const $=id=>{if(!elements.has(id))elements.set(id,{disabled:false,hidden:false,textContent:''});return elements.get(id)};
  let refreshed=0,cleared=0,lastStatus='';
  const ctx={$,PENDING:'cnidaria-pending-direct-challenge-v1',invite:'test-token',rpc:async()=>payload,status:t=>{lastStatus=t},sessionStorage:{removeItem:()=>cleared++},refresh:async()=>{refreshed++;if(refreshError)throw Error(refreshError)},Error};
  runInNewContext(code+';globalThis.invoke=respond',ctx);
  let error;
  try{await ctx.invoke(accept)}catch(e){error=e}
  return {error,elements,refreshed,cleared,lastStatus,invite:ctx.invite};
}
test('accept requires confirmed accepted state before hiding invitation',async()=>{
  const x=await exercise([{challenge_status:'accepted'}]);
  assert.equal(x.error,undefined);assert.equal(x.refreshed,1);assert.equal(x.cleared,1);assert.equal(x.elements.get('incoming').hidden,true);
});
test('decline requires confirmed declined state',async()=>{
  const x=await exercise([{challenge_status:'declined'}],false);
  assert.equal(x.error,undefined);assert.equal(x.refreshed,1);
});
for(const [label,payload] of [['empty response',[]],['null response',null],['wrong state',[{challenge_status:'pending'}]],['opposite state',[{challenge_status:'declined'}]]]){
 test(label+' must not claim acceptance',async()=>{
  const x=await exercise(payload);
  assert.match(String(x.error?.message),/Response status unknown.*Reload this invitation/);
  assert.equal(x.refreshed,0);assert.equal(x.cleared,0);
  assert.equal(x.elements.get('accept').disabled,true);
  assert.equal(x.elements.get('decline').disabled,true);
 });
}

test('transport failure preserves diagnostic reason without unlocking either response button',async()=>{
 const x=await exercise(Promise.reject(new Error('network timeout')));
 assert.match(String(x.error?.message),/Response status unknown \(network timeout\)/);
 assert.match(String(x.error?.message),/check Your challenges before retrying/);
 assert.equal(x.refreshed,0);
 assert.equal(x.cleared,0);
 assert.equal(x.elements.get('accept').disabled,true);
 assert.equal(x.elements.get('decline').disabled,true);
});

test('confirmed accept stays successful if list refresh fails',async()=>{
 const x=await exercise([{challenge_status:'accepted'}],true,'offline');
 assert.equal(x.error,undefined);
 assert.equal(x.refreshed,1);
 assert.equal(x.cleared,1);
 assert.equal(x.invite,null);
 assert.equal(x.elements.get('incoming').hidden,true);
 assert.equal(x.elements.get('accept').disabled,true);
 assert.match(x.lastStatus,/Response confirmed; challenge list refresh failed: offline/);
});
test('confirmed decline stays successful if list refresh fails',async()=>{
 const x=await exercise([{challenge_status:'declined'}],false,'offline');
 assert.equal(x.error,undefined);
 assert.equal(x.elements.get('decline').disabled,true);
 assert.equal(x.elements.get('incoming').hidden,true);
});

const previewStart=html.indexOf('async function preview(){');
const previewEnd=html.indexOf('\nasync function respond(accept){',previewStart);
assert.ok(previewStart>=0&&previewEnd>previewStart,'production preview handler must be extractable');
const previewCode=html.slice(previewStart,previewEnd);
async function exercisePreview(payload,initialEnabled=true){
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{disabled:!initialEnabled,hidden:false,textContent:'',classList:{add:()=>{}},querySelector:()=>({textContent:''}),prepend:()=>{}});return elements.get(id)};
 const statuses=[];
 const ctx={$,invite:'test-token',rpc:async()=>payload,status:t=>statuses.push(t),Date,document:{createElement:()=>({className:'',textContent:''})}};
 runInNewContext(previewCode+';globalThis.invokePreview=preview',ctx);
 await ctx.invokePreview();
 return {elements,statuses};
}
test('preview locks stale response buttons while request is pending',async()=>{
 let resolve;
 const pending=new Promise(r=>{resolve=r});
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{disabled:false,hidden:false,textContent:'',classList:{add:()=>{}},querySelector:()=>({textContent:''}),prepend:()=>{}});return elements.get(id)};
 const ctx={$,invite:'test-token',rpc:()=>pending,status:()=>{},Date,document:{createElement:()=>({className:'',textContent:''})}};
 runInNewContext(previewCode+';globalThis.invokePreview=preview',ctx);
 const running=ctx.invokePreview();
 assert.equal($('accept').disabled,true);
 assert.equal($('decline').disabled,true);
 resolve([{challenge_title:'Test',challenge_expires_at:'2026-11-20T00:00:00Z'}]);
 await running;
 assert.equal($('accept').disabled,false);
 assert.equal($('decline').disabled,false);
});
for(const [name,payload] of [['null RPC payload',null],['empty RPC payload',[]]]){
 test('preview treats '+name+' as unavailable without enabling response',async()=>{
  const x=await exercisePreview(payload);
  assert.equal(x.elements.get('accept').disabled,true);
  assert.equal(x.elements.get('decline').disabled,true);
  assert.match(x.elements.get('details').textContent,/expired or was already used/);
 });
}

test('mobile bfcache restore restarts challenge polling exactly once',async()=>{
 const start=html.indexOf('let syncTimer=null;');
 const end=html.indexOf('const hash=new URLSearchParams',start);
 assert.ok(start>=0&&end>start,'production polling lifecycle must be extractable');
 const handlers={};const timers=new Set();let next=0,refreshes=0;
 const ctx={
  syncChallenges:async()=>{refreshes++},
  setInterval:()=>{const id=++next;timers.add(id);return id},
  clearInterval:id=>timers.delete(id),
  document:{addEventListener:(name,cb)=>{handlers['document:'+name]=cb},visibilityState:'visible'},
  window:{addEventListener:(name,cb)=>{handlers['window:'+name]=cb}}
 };
 runInNewContext(html.slice(start,end),ctx);
 assert.equal(timers.size,1);
 handlers['window:pagehide']();
 assert.equal(timers.size,0);
 handlers['window:pageshow']({persisted:true});
 assert.equal(timers.size,1);
 assert.equal(refreshes,1);
 handlers['window:pageshow']({persisted:true});
 assert.equal(timers.size,1,'repeat restore must not leak duplicate timers');
 assert.equal(refreshes,2);
 handlers['window:pagehide']();
 handlers['window:pageshow']({persisted:false});
 assert.equal(timers.size,0,'ordinary navigation must not resurrect polling');
});
