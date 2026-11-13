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
  assert.match(String(x.error?.message),/could not be confirmed/);
  assert.equal(x.refreshed,0);assert.equal(x.cleared,0);
  assert.equal(x.elements.get('accept').disabled,false);
  assert.equal(x.elements.get('decline').disabled,false);
 });
}

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
