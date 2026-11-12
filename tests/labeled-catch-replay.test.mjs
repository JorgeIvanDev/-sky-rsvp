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
  assert.ok(fixture.examples.some(x => x.label === 'couch_bounce'));
  assert.ok(fixture.examples.some(x => x.label === 'couch_drop'));
  assert.equal(fixture.examples.filter(x => x.label === 'hand_catch').length, 2);
});
for (const example of fixture.examples.filter(x => Array.isArray(x.lastSamples))) {
  test(example.recordedAt + ': truncated trace never proves a hand catch', () => {
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
  const hand = fixture.examples.find(x => x.label === 'hand_catch' && Array.isArray(x.lastSamples));
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
  const match = html.match(/lastFlightOutcome=(\{postImpactStats,reboundDetected:impactReboundDetected,feet:Number\(feet\.toFixed\(2\)\)[\s\S]*?\});clearTimeout\(flightWatchdog\)/);
  assert.ok(match, 'must locate actual production outcome expression');
  function outcome({ samples, lastSampleAt, reason = 'No confirmed catch', impactAt = 1000 }) {
    const context = {
      feet: 4, target: () => 5, catchLike: false, flightFailureReason: reason,
      spinPeak: 0, flightSamples: 20, impactReviewSamples: samples,
      impactReviewAt: impactAt, lastMotionAt: lastSampleAt,
      Math, Number, impactReboundDetected: false, postImpactStats: null
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

// Execute the exact production outcome serializer against both user-labeled excerpts.
// The excerpts end on impact, so neither is evidence of a completed settle review.
test('production serializer preserves uncertainty for both historical labeled excerpts', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const match = html.match(/lastFlightOutcome=(\{postImpactStats,reboundDetected:impactReboundDetected,feet:Number\(feet\.toFixed\(2\)\)[\s\S]*?\});clearTimeout\(flightWatchdog\)/);
  assert.ok(match, 'production serializer must be found');
  for (const example of fixture.examples.filter(x => Array.isArray(x.lastSamples))) {
    const last = example.lastSamples.at(-1);
    const context = {
      postImpactStats: null, feet: example.reportedFeet, target: () => 5,
      catchLike: false, flightFailureReason: 'Post-impact sample timeout: no settle evidence',
      spinPeak: last.spin, flightSamples: example.lastSamples.length,
      impactReviewSamples: 0, impactReviewAt: last.ms,
      lastMotionAt: last.ms, impactReboundDetected: false, Math, Number
    };
    const result = runInNewContext('(' + match[1] + ')', context);
    assert.equal(result.handCatchVerified, false, example.label);
    assert.equal(result.catchDetected, false, example.label);
    assert.equal(result.postImpactMs, 0, example.label);
    assert.equal(result.postImpactCoverage, 'no_samples', example.label);
    assert.match(result.reason, /timeout/i, example.label);
  }
});


test('production coverage cannot be complete with sparse samples even without a failure reason', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const match = html.match(/lastFlightOutcome=(\{postImpactStats,reboundDetected:impactReboundDetected,feet:Number\(feet\.toFixed\(2\)\)[\s\S]*?\});clearTimeout\(flightWatchdog\)/);
  assert.ok(match, 'production outcome serializer must be present');
  const context = {
    postImpactStats: null, feet: 4, target: () => 5, catchLike: false,
    flightFailureReason: 'No confirmed catch', spinPeak: 0, flightSamples: 20,
    impactReviewSamples: 3, impactReviewAt: 1000, lastMotionAt: 1350, impactReboundDetected: false, Math, Number
  };
  const outcome = runInNewContext('(' + match[1] + ')', context);
  assert.equal(outcome.postImpactCoverage, 'insufficient_samples');
  assert.equal(outcome.handCatchVerified, false);
});

test('recent user-labeled hand and couch recordings retain distinct evidence and uncertainty', () => {
  const hand = fixture.examples.find(x => x.recordedAt === '2026-11-11T19:06:44.289Z');
  const couch = fixture.examples.find(x => x.recordedAt === '2026-11-11T19:11:20.179Z');
  assert.ok(hand && couch);
  assert.equal(hand.label, 'hand_catch');
  assert.equal(hand.postImpactSamples, 21);
  assert.equal(hand.postImpactMs, 350);
  assert.equal(hand.postImpactCoverage, 'observed_350ms');
  assert.equal(hand.reportedFeet < hand.targetFeet, true, 'genuine catch can be below target');
  assert.equal(couch.label, 'couch_drop');
  assert.equal(couch.postImpactCoverage, 'not_started');
  assert.equal(couch.postImpactSamples, 0);
  const impacts = couch.diagnosticSamples.filter(s => s.m > 20 && s.state === 'flying');
  assert.ok(impacts.length >= 3, 'multiple later impacts must remain visible in the couch fixture');
  assert.ok(impacts.at(-1).ms > impacts[0].ms, 're-impact follows first airborne collision');
  assert.match(couch.reason, /249 ms/, 'early freefall rejection must not be relabeled as a verified catch');
  // User labels are ground truth for evaluation, not proof that inertial sensors
  // can distinguish a hand from upholstery.
  assert.notEqual(hand.userConfirmed, couch.userConfirmed);
});

test('recent hand-catch observation has chronological measured samples, not invented full trace', () => {
  const hand = fixture.examples.find(x => x.recordedAt === '2026-11-11T19:06:44.289Z');
  assert.equal(hand.userConfirmed, 'Caught in hand, not couch');
  assert.equal(hand.postImpactSamples, 21);
  assert.equal(hand.postImpactMs, 350);
  assert.ok(hand.postImpactSamplesExcerpt.length < hand.postImpactSamples,
    'fixture contains representative samples, not all 21 raw readings');
  for (let i = 1; i < hand.postImpactSamplesExcerpt.length; i++) {
    assert.ok(hand.postImpactSamplesExcerpt[i].ms > hand.postImpactSamplesExcerpt[i - 1].ms,
      'post-impact excerpts must preserve increasing timestamps');
  }
  assert.ok(hand.postImpactSamplesExcerpt[0].ms > hand.impactSamples.at(-1).ms);
  assert.equal(hand.postImpactStats.samples, hand.postImpactSamples);
  assert.ok(hand.postImpactStats.maximumAcceleration >= hand.postImpactStats.minimumAcceleration);
  assert.equal(hand.reportedFeet < hand.targetFeet, true,
    'below-target does not mean the user-labeled genuine catch was rejected');
});

test('couch drop retains multiple distinct re-impacts without manufacturing post-impact review', () => {
  const couch = fixture.examples.find(x => x.recordedAt === '2026-11-11T19:11:20.179Z');
  const samples = couch.diagnosticSamples;
  for (let i = 1; i < samples.length; i++) {
    assert.ok(samples[i].ms > samples[i - 1].ms, 'diagnostic timestamps must increase');
  }
  const flyingImpacts = samples.filter(s => s.state === 'flying' && s.m > 20);
  assert.ok(flyingImpacts.length >= 4);
  assert.ok(flyingImpacts.at(-1).ms - flyingImpacts[0].ms >= 200,
    'late re-impact must remain distinguishable from first impact cluster');
  assert.equal(couch.postImpactSamples, 0);
  assert.equal(couch.postImpactCoverage, 'not_started');
  assert.equal(couch.reportedCatchDetected, false);
  assert.equal(couch.reportedFeet, 0);
});

test('production review guards sample gaps and timeouts before granting impact credit', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /if\(now-lastMotionAt>250\)\{flightFailureReason='Post-impact sensor gap/);
  assert.match(html, /impactReviewTimer=setTimeout\(\(\)=>\{if\(state==='impact-review'\)/);
  assert.match(html, /if\(impactReboundDetected\)\{flightFailureReason='Rebound after impact/);
  assert.match(html, /if\(impactReviewSamples<8\)/);
});

test('production motion state machine resets stale launch low-gravity window after a sensor gap', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const start = html.indexOf('function motion(e){');
  const end = html.indexOf('\nasync function submitScore', start);
  assert.ok(start > 0 && end > start, 'production motion function must be found');
  const source = html.slice(start, end);
  function runArmed(now, previousSampleAt, lowStartAt) {
    const context = {
      state: 'armed', lastMotionAt: previousSampleAt, lowStart: lowStartAt,
      lastLaunchImpulse: 1000, motionTrace: [], Math, Number,
      performance: { now: () => now }
    };
    runInNewContext(source + '\nmotion({accelerationIncludingGravity:{x:1,y:0,z:0},rotationRate:null})', context);
    return context;
  }
  const gap = runArmed(1400, 1050, 1000);
  assert.equal(gap.state, 'armed', 'stale low gravity cannot launch a flight');
  assert.equal(gap.lowStart, 0, 'a stale launch impulse cannot restart arming after a sensor gap');
  assert.equal(gap.lastLaunchImpulse, 0, 'the interrupted launch impulse must be discarded');
  assert.equal(gap.lastMotionAt, 1400);
  const continuous = runArmed(1080, 1050, 1000);
  assert.equal(continuous.state, 'armed');
  assert.equal(continuous.lowStart, 1000, 'continuous readings retain their low-gravity start');
  assert.equal(continuous.lastLaunchImpulse, 1000, 'continuous sensor readings retain a recent launch impulse');
});

test('production rebound detector requires adjacent near-weightless readings before a later impact', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const match = html.match(/if\(m<2\.5\)impactReboundLowSamples\+\+;else if\(m>16\)\{if\(impactReboundLowSamples>=2\)impactReboundDetected=true;impactReboundLowSamples=0\}else impactReboundLowSamples=0;/);
  assert.ok(match, 'test must execute the production rebound expression');
  function replay(values) {
    const context = { impactReboundLowSamples: 0, impactReboundDetected: false };
    for (const m of values) {
      context.m = m;
      runInNewContext(match[0], context);
    }
    return context.impactReboundDetected;
  }
  assert.equal(replay([1, 1, 25]), true, 'continuous freefall then re-impact is suspicious');
  assert.equal(replay([1, 9.8, 1, 25]), false, 'separated isolated lows are not continuous rebound');
  assert.equal(replay([1, 1, 9.8, 25]), false, 'settling between lows and impact breaks rebound sequence');
  assert.equal(replay([34, 58, 9.8, 9.8]), false, 'high catch spikes alone do not establish rebound');
});

test('production impact-review state machine does not bridge missing frames into a false rebound', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const start = html.indexOf('function motion(e){');
  const end = html.indexOf('\nasync function submitScore', start);
  assert.ok(start > 0 && end > start, 'production motion function must be found');
  const source = html.slice(start, end);
  function replay(readings) {
    const elements = new Map();
    const context = {
      state: 'impact-review', lastMotionAt: 1000, impactReviewAt: 1000,
      impactReviewFeet: 3, impactReviewSamples: 0, impactReboundLowSamples: 0,
      impactReboundDetected: false, motionTrace: [], flightFailureReason: '',
      Math, Number, performance: { now: () => context.clock },
      $: id => { if (!elements.has(id)) elements.set(id, {textContent: ''}); return elements.get(id); },
      complete: (feet, credited) => { context.completed = {feet, credited}; context.state = 'done'; }
    };
    for (const [clock, magnitude] of readings) {
      context.clock = clock;
      runInNewContext(source + '\nmotion({accelerationIncludingGravity:{x:' + magnitude + ',y:0,z:0},rotationRate:null})', context);
    }
    return context;
  }
  const rebound = replay([[1016,1],[1032,1],[1048,25]]);
  assert.equal(rebound.impactReboundDetected, true, 'adjacent freefall readings followed by impact remain suspicious');
  assert.equal(rebound.completed?.credited, false, 'rebound must not receive catch credit');
  const interrupted = replay([[1016,1],[1150,1],[1166,25]]);
  assert.equal(interrupted.impactReboundDetected, false, '130 ms missing frames break the low-gravity sequence');
  assert.equal(interrupted.completed, undefined, 'interrupted sequence alone must not end the review');
  assert.equal(interrupted.impactReviewSamples, 3);
  const gap = replay([[1016,1],[1290,1]]);
  assert.match(gap.flightFailureReason, /Post-impact sensor gap/, 'large sensor gap fails closed');
  assert.equal(gap.completed?.credited, false);
});

test('one-tap retry discards stale launch and first-impact evidence before arming', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const start = html.indexOf('function activate(){');
  const end = html.indexOf('\nfunction complete(', start);
  assert.ok(start > 0 && end > start, 'production activation function must exist');
  const source = html.slice(start, end);
  const elements = new Map();
  const context = {
    sensor: true, state: 'done', lastLaunchImpulse: 900, lastMotionAt: 950,
    impactStartedAt: 910, firstImpactFeet: 12, lowStart: 920, impactCount: 3,
    impactReviewTimer: null, settleTimer: null, flightWatchdog: null,
    motionTrace: [{ms:900}], failures: 0, spinPeak: 22, flightPeak: 12,
    flightSamples: 15, impactReviewSamples: 12, Math,
    performance: {now: () => 1000}, validNickname: () => true,
    clearTimeout: () => {}, setTimeout: () => 1,
    $: id => {if (!elements.has(id)) elements.set(id, {textContent:'', disabled:false}); return elements.get(id);}
  };
  runInNewContext(source + '\nactivate()', context);
  assert.equal(context.state, 'arming');
  for (const key of ['lastLaunchImpulse','lastMotionAt','impactStartedAt','firstImpactFeet','lowStart','impactCount','flightSamples']) {
    assert.equal(context[key], 0, key + ' must reset on retry');
  }
  assert.equal(context.motionTrace.length, 0, 'retry starts a fresh diagnostic trace');
  assert.equal(elements.get('activate').disabled, true, 'retry must not double-arm');
});

test('public scoreboard does not imply a sensor score is a verified hand catch', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /Sensor-reported score posted \(unverified; not proof of a hand catch\)/);
  assert.match(html, /Unverified sensor-reported leaderboard/);
  assert.doesNotMatch(html, /textContent='Score posted!'/);
  assert.match(html, /handCatchVerified\s*:\s*false/);
});

test('production arming cannot mistake startup low gravity for a toss without a launch impulse', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const start = html.indexOf('function motion(e){');
  const end = html.indexOf('\nasync function submitScore', start);
  assert.ok(start > 0 && end > start);
  const source = html.slice(start, end);
  function sample(now, impulse, lowStart) {
    const context = {
      state:'armed', lastMotionAt:0, lowStart, lastLaunchImpulse:impulse,
      motionTrace:[], Math, Number, performance:{now:()=>now}
    };
    runInNewContext(source + '\nmotion({accelerationIncludingGravity:{x:1,y:0,z:0},rotationRate:null})', context);
    return context;
  }
  const missing = sample(120,0,1);
  assert.equal(missing.state,'armed','startup freefall must not launch without an impulse');
  assert.equal(missing.lowStart,0,'startup low-gravity window must reset');
  const valid = sample(120,50,80);
  assert.equal(valid.state,'armed','recent impulse may preserve the low-gravity window');
  assert.equal(valid.lowStart,80);
});


test('production impact-review replays 350ms with 21 measured readings, sparse coverage and couch re-impact', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const start = html.indexOf('function motion(e){');
  const end = html.indexOf('\nasync function submitScore', start);
  assert.ok(start > 0 && end > start, 'execute production motion state machine');
  const source = html.slice(start, end);
  function replay(readings) {
    const elements = new Map();
    const context = {
      state: 'impact-review', lastMotionAt: 1000, impactReviewAt: 1000,
      impactReviewFeet: 3, impactReviewSamples: 0, impactReboundLowSamples: 0,
      impactReboundDetected: false, motionTrace: [], flightFailureReason: '',
      Math, Number, performance: {now: () => context.clock},
      $: id => {if (!elements.has(id)) elements.set(id, {textContent: ''}); return elements.get(id);},
      complete: (feet, credited) => {context.completed = {feet, credited}; context.state = 'done';}
    };
    for (const [clock, magnitude] of readings) {
      context.clock = clock;
      runInNewContext(source + '\nmotion({accelerationIncludingGravity:{x:' + magnitude + ',y:0,z:0},rotationRate:null})', context);
    }
    return context;
  }
  // Synthetic timings exercise production logic, not fabricated readings from the user's trace.
  const continuous = replay(Array.from({length:21}, (_, i) => [1000 + 17.5 * (i + 1), 9.8]));
  assert.equal(continuous.impactReviewSamples, 21);
  assert.equal(continuous.completed?.credited, true, 'complete settle observation may receive unverified gameplay credit');
  assert.match(continuous.flightFailureReason, /cannot be verified from motion alone/);
  const sparse = replay([[1050,9.8],[1100,9.8],[1150,9.8],[1200,9.8],[1250,9.8],[1300,9.8],[1350,9.8]]);
  assert.equal(sparse.completed?.credited, false);
  assert.match(sparse.flightFailureReason, /coverage insufficient/);
  const rebound = replay([[1017,1],[1034,1],[1051,25],[1360,9.8]]);
  assert.equal(rebound.completed?.credited, false, 'couch-like rebound fails before any later reading');
  assert.equal(rebound.impactReboundDetected, true);
  const gap = replay([[1017,9.8],[1290,9.8]]);
  assert.equal(gap.completed?.credited, false);
  assert.match(gap.flightFailureReason, /sensor gap/);
});
