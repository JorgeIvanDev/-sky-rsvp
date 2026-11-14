import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../direct-challenge.html',import.meta.url),'utf8');
const start=html.indexOf("$('submit-toss').onclick=()=>run(async()=>{");
const end=html.indexOf("\n$('accept').onclick",start);
assert.ok(start>=0&&end>start,'production submit handler must be extractable');
const code=html.slice(start,end);
async function exercise(payload,{refreshError=false,rpcError=false}={}){
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{disabled:false,dataset:{challenge:'test-challenge'},value:'850',checked:true,textContent:''});return elements.get(id)};
 let refreshes=0,error=null;
 const ctx={$,Number,Error,Array,submitBusy:false,chosenExpiresAt:'2099-01-01T00:00:00Z',Date,run:fn=>Promise.resolve().then(fn).catch(e=>{error=e}),rpc:async()=>{if(rpcError)throw Error('network unavailable');return payload},refresh:async()=>{refreshes++;if(refreshError)throw Error('refresh unavailable')}};
 runInNewContext(code,ctx);
 await ctx.$('submit-toss').onclick();
 return {error,refreshes,elements};
}
for(const result of ['waiting','win','loss','tie']){
 test('confirmed '+result+' submission updates the UI',async()=>{
  const x=await exercise([{result}]);
  assert.equal(x.error,null);
  assert.equal(x.refreshes,1);
  assert.ok(x.elements.get('play-result').textContent);
 });
}
for(const [label,payload] of [['empty',[]],['null',null],['unknown',[{result:'unknown'}]],['missing result',[{}]]]){
 test(label+' server response cannot claim a saved toss',async()=>{
  const x=await exercise(payload);
  assert.match(String(x.error?.message),/not confirmed/);
  assert.equal(x.refreshes,0);
  assert.match(x.elements.get('play-result')?.textContent||'',/Submission status unknown/);
 });
}

test('confirmed toss remains locked when list refresh fails',async()=>{
 const x=await exercise([{result:'waiting'}],{refreshError:true});
 assert.equal(x.error,null);
 assert.equal(x.refreshes,1);
 assert.equal(x.elements.get('submit-toss').disabled,true);
 assert.match(x.elements.get('play-result').textContent,/Score confirmed; challenge list refresh failed/);
});
test('confirmed winning toss remains locked when list refresh fails',async()=>{
 const x=await exercise([{result:'win'}],{refreshError:true});
 assert.equal(x.error,null);
 assert.equal(x.elements.get('submit-toss').disabled,true);
 assert.match(x.elements.get('play-result').textContent,/You won/);
});
test('uncertain transport failure requires refresh before retry',async()=>{
 const x=await exercise(null,{rpcError:true});
 assert.match(String(x.error?.message),/network unavailable/);
 assert.equal(x.refreshes,0);
 assert.equal(x.elements.get('submit-toss').disabled,true);
});
