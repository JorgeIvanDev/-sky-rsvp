import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../direct-challenge.html',import.meta.url),'utf8');
const start=html.indexOf("$('submit-toss').onclick=()=>run(async()=>{");
const end=html.indexOf("\n$('accept').onclick",start);
assert.ok(start>=0&&end>start,'production submit handler must be extractable');
const code=html.slice(start,end);
async function exercise(payload){
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{disabled:false,dataset:{challenge:'test-challenge'},value:'850',checked:true,textContent:''});return elements.get(id)};
 let refreshes=0,error=null;
 const ctx={$,Number,Error,Array,run:fn=>Promise.resolve().then(fn).catch(e=>{error=e}),rpc:async()=>payload,refresh:async()=>{refreshes++}};
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
  assert.equal(x.elements.get('play-result')?.textContent||'','');
 });
}
