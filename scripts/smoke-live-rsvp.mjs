#!/usr/bin/env node
// Opt-in production RSVP smoke test. Creates ONE clearly labelled test invite and reply.
// Usage: CNIDARIA_SMOKE_CONFIRM=YES node scripts/smoke-live-rsvp.mjs
// Never prints capability secrets or guest details.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const url = 'https://hwkxuczipnaqzhbnaurw.supabase.co/functions/v1/cnidaria-rsvp';
if (process.env.CNIDARIA_SMOKE_CONFIRM !== 'YES') {
  console.error('Refusing to create production test data without CNIDARIA_SMOKE_CONFIRM=YES');
  process.exit(2);
}
async function call(action, extra = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://jorgeivandev.github.io' },
    body: JSON.stringify({ action, ...extra }),
    signal: AbortSignal.timeout(12000)
  });
  let body;
  try { body = await response.json(); } catch { throw Error(action + ': invalid JSON response'); }
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://jorgeivandev.github.io', action + ': CORS');
  return { status: response.status, body };
}
const marker = randomUUID().slice(0, 8);
try {
  const created = await call('create', { title: '[CNIDARIA SMOKE TEST] ' + marker });
  assert.equal(created.status, 200, 'create');
  assert.match(created.body.inviteId, /^[0-9a-f-]{36}$/i);
  assert.ok(created.body.hostSecret?.length >= 40);
  console.log('PASS: production invite created');
  const inviteId = created.body.inviteId;
  const denied = await call('inbox', { inviteId, hostSecret: randomUUID() + randomUUID() });
  assert.equal(denied.status, 401, 'wrong host secret must be denied');
  assert.ok(!denied.body.replies, 'unauthorized response must not contain guest data');
  console.log('PASS: unauthorized inbox denied');
  const expected = ['yes', 'maybe', 'no'].map(choice => ({ name: 'CNIDARIA QA ' + marker + ' ' + choice, choice }));
  for (const guest of expected) {
    const replied = await call('reply', { inviteId, name: guest.name, choice: guest.choice });
    assert.equal(replied.status, 200, guest.choice + ' reply');
    assert.equal(replied.body.saved, true);
  }
  console.log('PASS: Yes / Maybe / No guest RSVPs accepted');
  const inbox = await call('inbox', { inviteId, hostSecret: created.body.hostSecret });
  assert.equal(inbox.status, 200, 'authorized inbox');
  for (const guest of expected) {
    assert.ok(inbox.body.replies?.some(r => r.guest_name === guest.name && r.choice === guest.choice), 'missing private receipt: ' + guest.choice);
  }
  console.log('PASS: private host inbox received all three exact guest RSVPs');
  console.log('Production API vertical slice PASS; mobile UI still requires manual verification.');
} catch (error) {
  console.error('FAIL:', error.message);
  process.exitCode = 1;
}
