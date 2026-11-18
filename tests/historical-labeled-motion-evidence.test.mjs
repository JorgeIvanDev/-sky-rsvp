import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {replayObserved} from '../cnidaria-motion-core.mjs';

const {examples}=JSON.parse(readFileSync(new URL('./labeled-catch-examples.json',import.meta.url),'utf8'));
const byTime=t=>examples.find(e=>e.recordedAt===t);

test('user-labeled couch drop preserves actual multiple impacts without inventing missing frames',()=>{
 const e=byTime('2026-11-11T19:11:20.179Z');
 assert.equal(e.label,'couch_drop');
 assert.equal(e.reason,'Impact before sustained free fall (249 ms)');
 assert.deepEqual(e.diagnosticSamples.filter(s=>s.m>16).map(s=>s.ms),[7666,7683,8016,8033,8050,8250]);
 assert.equal(e.postImpactSamples,0);
 const observed=e.diagnosticSamples.map(({ms,m,spin})=>({ms,m,spin}));
 const outcome=replayObserved(observed);
 assert.equal(outcome.ok,false,'partial bounce/tumble excerpt cannot qualify for catch-like credit');
});

test('user-confirmed hand catch summary is not a full trace and cannot be treated as replay proof',()=>{
 const e=byTime('2026-11-11T19:06:44.289Z');
 assert.equal(e.label,'hand_catch');
 assert.equal(e.postImpactMs,350);
 assert.equal(e.postImpactSamples,21);
 assert.ok(e.postImpactSamplesExcerpt.length<e.postImpactSamples);
 assert.equal(e.postImpactCoverage,'observed_350ms');
 const excerpt=[...e.impactSamples,...e.postImpactSamplesExcerpt];
 assert.ok(excerpt.every((s,i)=>i===0||s.ms>excerpt[i-1].ms));
 assert.equal(replayObserved(excerpt).ok,false,'impact and selected readings alone cannot reconstruct launch or settle');
});

test('historical labels cannot be replaced by inferred impact magnitude or spin',()=>{
 const couch=byTime('2026-11-11T19:11:20.179Z');
 const hand=byTime('2026-11-11T19:06:44.289Z');
 assert.ok(couch.diagnosticSamples.some(s=>s.m>hand.impactSamples[0].m));
 assert.equal(couch.userConfirmed,'Couch drop, not a hand catch');
 assert.equal(hand.userConfirmed,'Caught in hand, not couch');
});
