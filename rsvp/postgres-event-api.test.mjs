import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresEventApi } from './postgres-event-api.mjs';

const ids = ['123e4567-e89b-42d3-a456-426614174000',
  '123e4567-e89b-42d3-a456-426614174001',
  '123e4567-e89b-42d3-a456-426614174002',
  '123e4567-e89b-42d3-a456-426614174003',
  '123e4567-e89b-42d3-a456-426614174004'];
const [inviteId, recipientId, challengeId, userId, receiptId] = ids;
const body = { inviteId, recipientId, challengeId, idempotencyKey: 'a'.repeat(64), choice: 'yes' };
const savedAt = '2026-11-07T12:00:00Z';
function makeApi({ authenticated = true, allowed = true } = {}) {
  const calls = [];
  const db = { query: async query => {
    calls.push(query);
    return { rows: [{ receipt_id: receiptId, saved_choice: 'yes', saved_at: savedAt }] };
  } };
  const api = createPostgresEventApi({
    db,
    authenticate: async () => authenticated ? { userId } : null,
    rateLimitRsvp: async () => true,
    rateLimitInbox: async () => true,
    authorizeRecipient: async () => allowed,
    loadInvite: async () => ({ id: inviteId, ownerUserId: userId, deletedAt: null }),
    readResponses: async () => [{ receiptId, choice: 'yes', savedAt }]
  });
  return { api, calls };
}
function request() {
  return new Request('https://example.test/api/rsvp', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, userId: recipientId })
  });
}
test('trusted event API binds server identity and writes through private SQL', async () => {
  const { api, calls } = makeApi();
  const response = await api(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { receiptId, choice: 'yes', savedAt });
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /cnidaria_internal\.submit_beta_rsvp/);
  assert.deepEqual(calls[0].values, [userId, inviteId, recipientId, challengeId, body.idempotencyKey, 'yes']);
});
test('denied recipient and unauthenticated requests never reach database', async () => {
  for (const options of [{ allowed: false }, { authenticated: false }]) {
    const { api, calls } = makeApi(options);
    assert.equal((await api(request())).status, 403);
    assert.equal(calls.length, 0);
  }
});
test('missing private database fails closed at construction', () => {
  assert.throws(() => createPostgresEventApi({ db: {} }), TypeError);
});
