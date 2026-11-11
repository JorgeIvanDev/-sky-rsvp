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
  assert.match(html, /postImpactMs:impactReviewAt&&impactReviewSamples\?Math\.max\(0,Math\.round\(lastMotionAt-impactReviewAt\)\):0/, 'elapsed post-impact time must come from actual samples, not a timeout clock');
});
