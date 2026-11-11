#!/usr/bin/env node
// Replay only the sensor excerpts actually supplied by the user.
// Missing post-impact readings MUST NOT be synthesized.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('./labeled-catch-examples.json', import.meta.url), 'utf8'));
function classifyExcerpt(example) {
  const samples = example.lastSamples;
  assert.ok(Array.isArray(samples) && samples.length >= 2);
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i].ms > samples[i-1].ms, 'timestamps must increase');
  const lastImpact = samples.findLast(s => s.m > 16);
  const after = lastImpact ? samples.filter(s => s.ms > lastImpact.ms) : [];
  const duration = after.length ? after.at(-1).ms - lastImpact.ms : 0;
  // An impact is not a verified catch. Without >=250 ms of post-impact data,
  // preserve the user's label for evaluation but return unverified.
  return {
    impactObserved: !!lastImpact,
    verifiedHandCatch: false,
    status: duration < 250 ? 'unverified_missing_post_impact' : 'unverified_needs_full_trace',
    postImpactMs: duration,
    userLabel: example.label
  };
}
test('fixture has separately user-labeled couch bounce and hand catch', () => {
  assert.deepEqual(fixture.examples.map(x => x.label).sort(), ['couch_bounce','hand_catch']);
});
for (const example of fixture.examples) {
  test(example.label + ': truncated trace never proves a hand catch', () => {
    const result = classifyExcerpt(example);
    assert.equal(result.impactObserved, true);
    assert.equal(result.verifiedHandCatch, false);
    assert.equal(result.status, 'unverified_missing_post_impact');
    assert.equal(result.postImpactMs, 0);
    assert.equal(result.userLabel, example.label);
    if (example.label === 'couch_bounce') assert.equal(result.verifiedHandCatch, false, 'couch false positive must not be verified');
    if (example.label === 'hand_catch') assert.notEqual(result.status, 'rejected_hand_catch', 'genuine catch remains inconclusive, not rejected');
  });
}

test('production motion outcome does not claim a verified hand catch from impact alone', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /handCatchVerified\s*:\s*false/, 'production outcome must explicitly mark hand catch unverified');
  assert.match(html, /postImpactSamples\s*:/, 'production outcome must export post-impact sample count');
  assert.match(html, /postImpactMs\s*:/, 'production outcome must export post-impact duration');
  assert.match(html, /state\s*=\s*['"]impact-review['"]/, 'production must enter post-impact review');
  assert.match(html, /motionTrace\.slice\(\)/, 'production must preserve recorded sensor trace');
  assert.match(html, /postImpactCoverage:!impactReviewAt\?'not_started'/, 'diagnostics must identify missing post-impact observation');
  assert.match(html, /'sensor_gap':flightFailureReason\.startsWith\('Post-impact sample timeout'\)\?'timeout'/, 'diagnostics must distinguish sensor gaps from timeouts');
  assert.match(html, /postImpactMs:impactReviewAt&&impactReviewSamples\?Math\.max\(0,Math\.round\(lastMotionAt-impactReviewAt\)\):0/, 'elapsed post-impact time must come from actual samples, not a timeout clock');
});

test('historical positive catch flags are not ground truth', () => {
  const couch = fixture.examples.find(x => x.label === 'couch_bounce');
  const hand = fixture.examples.find(x => x.label === 'hand_catch');
  assert.equal(couch.reportedCatchDetected, true, 'fixture must preserve the original false positive');
  assert.equal(hand.reportedCatchDetected, true, 'fixture must preserve the original genuine catch');
  assert.notEqual(couch.userConfirmed, hand.userConfirmed);
  for (const example of [couch, hand]) {
    const final = example.lastSamples.at(-1);
    const result = classifyExcerpt(example);
    assert.equal(result.postImpactMs, 0, 'no post-impact samples exist after final impact');
    assert.equal(result.verifiedHandCatch, false, 'legacy positive flag must not override missing evidence');
    assert.ok(final.m > 16, 'recording really ends at an impact');
  }
});

test('replay rejects malformed timestamps rather than silently manufacturing coverage', () => {
  const original = fixture.examples[0];
  const malformed = { ...original, lastSamples: original.lastSamples.map(s => ({...s})) };
  malformed.lastSamples[2].ms = malformed.lastSamples[1].ms;
  assert.throws(() => classifyExcerpt(malformed), /timestamps must increase/);
});

test('production requires multiple real post-impact samples before impact-based gameplay credit', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /if\(impactReviewSamples<8\)/, 'a sparse post-impact trace must not receive gameplay credit');
  assert.match(html, /Post-impact sample coverage insufficient: hand catch unverified/, 'sparse sensor data must be labeled unverified');
  assert.match(html, /complete\(impactReviewFeet,false\)/, 'insufficient samples must fail closed');
});

test('sparse post-impact coverage is not exported as complete', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /flightFailureReason\.startsWith\('Post-impact sample coverage insufficient'\)\?'insufficient_samples'/,
    '350 ms with fewer than eight readings must be exported as insufficient_samples, not observed_350ms');
});

import { runInNewContext } from 'node:vm';

test('execute production outcome serializer against sparse and complete sensor coverage', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const match = html.match(/lastFlightOutcome=(\{feet:Number\(feet\.toFixed\(2\)\)[\s\S]*?\});clearTimeout\(flightWatchdog\)/);
  assert.ok(match, 'must locate actual production outcome expression');
  function outcome({ samples, lastSampleAt, reason = 'No confirmed catch', impactAt = 1000 }) {
    const context = {
      feet: 4, target: () => 5, catchLike: false, flightFailureReason: reason,
      spinPeak: 0, flightSamples: 20, impactReviewSamples: samples,
      impactReviewAt: impactAt, lastMotionAt: lastSampleAt,
      Math, Number
    };
    return runInNewContext('(' + match[1] + ')', context);
  }
  const noSamples = outcome({samples:0,lastSampleAt:1000});
  assert.equal(noSamples.postImpactMs, 0);
  assert.equal(noSamples.postImpactCoverage, 'no_samples');
  const sparse = outcome({samples:3,lastSampleAt:1350,reason:'Post-impact sample coverage insufficient: hand catch unverified'});
  assert.equal(sparse.postImpactMs, 350);
  assert.equal(sparse.postImpactCoverage, 'insufficient_samples');
  assert.equal(sparse.handCatchVerified, false);
  const complete = outcome({samples:12,lastSampleAt:1360});
  assert.equal(complete.postImpactMs, 360);
  assert.equal(complete.postImpactCoverage, 'observed_350ms');
  assert.equal(complete.handCatchVerified, false);
  const gap = outcome({samples:4,lastSampleAt:1150,reason:'Post-impact sensor gap'});
  assert.equal(gap.postImpactCoverage, 'sensor_gap');
  const timeout = outcome({samples:4,lastSampleAt:1200,reason:'Post-impact sample timeout: catch unverified'});
  assert.equal(timeout.postImpactMs, 200, 'timeout cannot manufacture additional sensor time');
  assert.equal(timeout.postImpactCoverage, 'timeout');
  assert.equal(timeout.handCatchVerified, false);
  const incomplete = outcome({samples:9,lastSampleAt:1275});
  assert.equal(incomplete.postImpactMs, 275);
  assert.equal(incomplete.postImpactCoverage, 'incomplete');
  assert.equal(incomplete.handCatchVerified, false);
  const noReview = outcome({samples:0,lastSampleAt:0,impactAt:0});
  assert.equal(noReview.postImpactCoverage, 'not_started');
  assert.equal(noReview.postImpactMs, 0);
});
