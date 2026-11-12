import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeReplies,renderReplySummary} from './dashboard.mjs';
test('counts RSVP choices without counting unknown values',()=>{
 assert.deepEqual(summarizeReplies([{choice:'yes'},{choice:'maybe'},{choice:'yes'},{choice:'no'},{choice:'unknown'}]),{yes:2,maybe:1,no:1});
});
test('empty dashboard shows zeros',()=>assert.deepEqual(summarizeReplies([]),{yes:0,maybe:0,no:0}));
test('renderer inserts only text nodes, never untrusted HTML',()=>{
 const elements=[];
 const doc={createElement(tag){const node={tag,textContent:'',children:[],attributes:{},setAttribute(k,v){this.attributes[k]=v},append(...nodes){this.children.push(...nodes)}};elements.push(node);return node;},createTextNode(value){return {text:value}}};
 const root={ownerDocument:doc,replaceChildren(){this.children=[]},append(node){this.children.push(node)}};
 const result=renderReplySummary(root,[{choice:'yes'}]);
 assert.deepEqual(result,{yes:1,maybe:0,no:0});
 assert.equal(root.children.length,3);
 assert.equal(root.children[0].children[0].textContent,'1');
});
