import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionTrace} from '../cnidaria-motion-core.mjs';

function trace(){const t=createMotionTrace({maxSamples:8});for(let i=0;i<4;i++)assert.equal(t.add({timestamp:100+i*16,magnitude:9.8,spin:i}),true);return t;}
for(const [label,mutate] of [
 ['magnitude edit',s=>{s[1].m=18}],
 ['spin edit',s=>{s[1].spin=900}],
 ['timestamp edit',s=>{s[1].ms=17}],
 ['replace sample',s=>{s[1]={...s[1]}}],
 ['reorder samples',s=>{[s[0],s[1]]=[s[1],s[0]]}],
 ['invalid object',s=>{s[1]=null}],
])test('collector rejects '+label+' without relying on sample count',()=>{const t=trace();mutate(t.samples);const r=t.evaluate();assert.equal(r.ok,false);assert.equal(r.reason,'invalid motion trace sample');t.reset();assert.equal(t.add({timestamp:200,magnitude:9.8}),true);assert.notEqual(t.evaluate().reason,'invalid motion trace sample')});
test('collector does not expose internal accepted snapshots',()=>{const t=trace();assert.equal(t.samples.length,4);assert.equal(t.evaluate().ok,false);assert.notEqual(t.evaluate().reason,'invalid motion trace sample')});
