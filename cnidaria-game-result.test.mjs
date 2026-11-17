import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGameResult} from './cnidaria-game-result.mjs';
test('shared result remains unverified even after catch-like motion',()=>{
 const r=normalizeGameResult({feet:3,airborneSpin:60,catchDetected:true,postImpactCoverage:'observed_350ms'});
 assert.equal(r.handCatchVerified,false);assert.equal(r.catchLike,true);assert.equal(r.eligibleForBetaReview,true);assert.ok(r.estimatedAirtimeMs>100);assert.equal(Object.isFrozen(r),true);
});
test('sensor gaps and incomplete post-impact traces never qualify for beta review',()=>{
 for(const coverage of ['sensor_gap','insufficient_samples','timeout','incomplete','unknown']){
  assert.equal(normalizeGameResult({feet:3,airborneSpin:0,catchDetected:true,postImpactCoverage:coverage}).eligibleForBetaReview,false);
 }
});
test('malformed and impossible values fail closed',()=>{
 for(const x of [null,{},[],{feet:-1,airborneSpin:0},{feet:Infinity,airborneSpin:0},{feet:2,airborneSpin:NaN}])assert.equal(normalizeGameResult(x),null);
});
