import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const match=html.match(/document\.addEventListener\('visibilitychange',(\(\)=>\{if\(document\.hidden&&\['arming','armed','flying','impact-review'\][^\n]+?)\);window\.addEventListener\('pageshow'/);
assert.ok(match,'solo game visibility interruption handler exists');

function simulate(state,hidden=true){
 const calls=[],elements=new Map(),trace=[{ms:100,state:'flying',g:0.5}];
 const $=id=>{if(!elements.has(id))elements.set(id,{textContent:''});return elements.get(id)};
 const context={document:{hidden},state,motionTrace:trace,lastFlightTrace:null,disarm(){calls.push('disarm');context.state='off'},loadBoard(){calls.push('board')} ,$};
 runInNewContext('('+match[1]+')()',context);
 return {calls,context,$};
}
for(const state of ['arming','armed','flying','impact-review']){
 test('background interrupts '+state+' without posting a score',()=>{
  const {calls,context,$}=simulate(state);
  assert.deepEqual(calls,['disarm']);
  assert.equal(context.state,'off');
  assert.equal(context.lastFlightTrace.length,1);
  assert.match($('detail').textContent,/No score was submitted/);
 });
}
test('background does not interrupt a completed attempt',()=>{
 const {calls}=simulate('done');assert.deepEqual(calls,[]);
});
test('foreground refreshes Hall of Fame without resetting active game',()=>{
 const {calls}=simulate('flying',false);assert.deepEqual(calls,['board']);
});
