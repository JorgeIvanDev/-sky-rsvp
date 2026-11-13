import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const copy=html.match(/\$\('copyMotionTrace'\)\.onclick=(async\(\)=>\{[^\n]+\});/);
assert.ok(copy,'production motion trace copy handler must be present');

async function execute({samples=[{ms:1}],clipboard='success'}={}){
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{textContent:''});return elements.get(id)};
 let copied;
 const navigator=clipboard==='missing'?{}:{clipboard:{writeText:async value=>{if(clipboard==='reject')throw Error('Permission denied');copied=value}}};
 const context={navigator,$,lastFlightTrace:samples,motionTraceReport:()=>JSON.stringify({samples})};
 await runInNewContext('('+copy[1]+')()',context);
 return {status:$('traceExportStatus').textContent,copied};
}
test('copy trace with no completed attempt shows actionable message',async()=>{
 const result=await execute({samples:[]});
 assert.match(result.status,/no completed flight trace/i);
 assert.equal(result.copied,undefined);
});
test('copy trace success confirms sample count',async()=>{
 const result=await execute({samples:[{ms:1},{ms:2}]});
 assert.deepEqual(JSON.parse(result.copied).samples,[{ms:1},{ms:2}]);
 assert.match(result.status,/2 samples/i);
});
test('missing clipboard API points to trace download',async()=>{
 const result=await execute({clipboard:'missing'});
 assert.match(result.status,/download motion trace/i);
});
test('rejected clipboard permission points to trace download',async()=>{
 const result=await execute({clipboard:'reject'});
 assert.match(result.status,/download motion trace/i);
});
