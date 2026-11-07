import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateEventApi } from './private-event-api.mjs';

const inviteId = '123e4567-e89b-42d3-a456-426614174000';
const recipientId = '123e4567-e89b-42d3-a456-426614174001';
const challengeId = '123e4567-e89b-42d3-a456-426614174002';
const userId = '123e4567-e89b-42d3-a456-426614174003';
const payload = { inviteId, recipientId, challengeId, idempotencyKey: 'a'.repeat(64), choice: 'yes' };
const receipt = { receiptId: 'receipt-1', choice: 'yes', savedAt: '2026-11-07T12:00:00Z' };
function setup(overrides = {}) {
  const calls = [];
  const api = createPrivateEventApi({
    authenticate: async request => {
      calls.push('authenticate');
      return request.headers.get('authorization') === 'Bearer verified'
        ? { userId } : null;
    },
    rateLimitRsvp: async () => { calls.push('rate-rsvp'); return true; },
    rateLimitInbox: async () => { calls.push('rate-inbox'); return true; },
    authorizeRecipient: async () => { calls.push('authorize'); return true; },
    submitAtomic: async input => {
      calls.push('atomic');
      assert.equal(input.userId, userId);
      return receipt;
    },
    loadInvite: async () => { calls.push('load'); return { id: inviteId, ownerUserId: userId, deletedAt: null }; },
    readResponses: async () => { calls.push('read'); return [{ ...receipt, privateEmail: 'hidden@example.test' }]; },
    ...overrides
  });
  return { api, calls };
}
const post = (token = 'verified') => new Request('https://example.test/api/rsvp', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(payload)
});
const inbox = (token = 'verified') => new Request(
  'https://example.test/api/host-inbox?inviteId=' + inviteId + '&limit=10',
  { headers: { Authorization: 'Bearer ' + token } }
);
test('recipient RSVP and private host inbox traverse the same trusted API', async () => {
  const { api, calls } = setup();
  const saved = await api(post());
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), receipt);
  const viewed = await api(inbox());
  assert.equal(viewed.status, 200);
  assert.deepEqual(await viewed.json(), { responses: [receipt] });
  assert.deepEqual(calls, ['authenticate', 'rate-rsvp', 'authorize', 'atomic',
    'authenticate', 'rate-inbox', 'load', 'read']);
});
test('unauthenticated requests cannot authorize, write or read', async () => {
  const { api, calls } = setup();
  assert.equal((await api(post('invalid'))).status, 403);
  assert.equal((await api(inbox('invalid'))).status, 403);
  assert.deepEqual(calls, ['authenticate', 'authenticate']);
});
test('non-owner cannot read private responses', async () => {
  const { api, calls } = setup({
    loadInvite: async () => ({ id: inviteId, ownerUserId: recipientId, deletedAt: null })
  });
  assert.equal((await api(inbox())).status, 403);
  assert.ok(!calls.includes('read'));
});
test('missing trusted dependency prevents API construction', () => {
  assert.throws(() => createPrivateEventApi({}), TypeError);
});
