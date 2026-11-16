// Regression guard for numeric overflow in the live homepage motion collector.
// Run: node --test tests/motion-overflow-regression.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const motion = html.slice(html.indexOf('function motion(e){'), html.indexOf('function motion(e){') + 8500);

test('live collector rejects overflowed acceleration magnitude before trace mutation', () => {
  assert.match(motion, /const accelerationMagnitudeValid=Number\.isFinite\(m\);if\(!accelerationMagnitudeValid\)return;/);
  assert.ok([1e308,1e308,1e308].every(Number.isFinite));
  assert.equal(Number.isFinite(Math.hypot(1e308,1e308,1e308)), false);
  assert.equal(Number.isFinite(Math.hypot(0,0,9.81)), true);
});

test('live collector converts overflowed rotation magnitude to zero', () => {
  assert.match(motion, /const spin=Number\.isFinite\(rawSpin\)\?rawSpin:0;/);
  assert.equal(Number.isFinite(Math.hypot(1e308,1e308,1e308)), false);
  assert.equal(Math.hypot(0,0,180),180);
});
