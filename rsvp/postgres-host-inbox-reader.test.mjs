import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresHostInboxReader } from './postgres-host-inbox-reader.mjs';
import { createPostgresEventApi } from './postgres-event-api.mjs';

const host = '123e4567-e89b-42d3-a456-426614174003';
const invite = '123e4567-e89b-42d3-a456-426614174000';
const receipt = '123e4567-e89b-42d3-a456-426614174004';
const savedAt = '2026-11-07T12:00:00Z';

test('host inbox binds verified host and invite, returns only receipt fields', async () => {
  const calls = [];
  const reader = createPostgresHostInboxReader({ query: async q => {
    calls.push(q);
    return { rows: [{ receipt_id: receipt, choice: 'yes', saved_at: savedAt, secret: 'never return' }] };
  } });
  assert.deepEqual(await reader({ hostUserId: host, inviteId: invite, limit: 10 }),
    [{ receiptId: receipt, choice: 'yes', savedAt }]);
  assert.match(calls[0].text, /cnidaria_internal\.read_beta_host_inbox/);
  assert.deepEqual(calls[0].values, [host, invite, 10]);
  assert.doesNotMatch(calls[0].text, new RegExp(host));
});

test('invalid host, invite, or limits never query database', async () => {
  let calls = 0;
  const reader = createPostgresHostInboxReader({ query: async () => { calls++; return { rows: [] }; } });
  for (const input of [
    { hostUserId: 'fake', inviteId: invite, limit: 10 },
    { hostUserId: host, inviteId: 'fake', limit: 10 },
    { hostUserId: host, inviteId: invite, limit: 51 },
    { hostUserId: host, inviteId: invite, limit: 1.5 }
  ]) await assert.rejects(reader(input), /Inbox unavailable/);
  assert.equal(calls, 0);
});

test('malformed database rows and oversized result fail closed', async () => {
  for (const rows of [[{ receipt_id: receipt, choice: 'yes', saved_at: 'invalid' }],
    [{ receipt_id: receipt, choice: 'other', saved_at: savedAt }],
    Array(2).fill({ receipt_id: receipt, choice: 'yes', saved_at: savedAt })]) {
    const reader = createPostgresHostInboxReader({ query: async () => ({ rows }) });
    await assert.rejects(reader({ hostUserId: host, inviteId: invite, limit: 1 }), /Inbox unavailable/);
  }
});

test('event API uses guarded PostgreSQL reader by default for host inbox', async () => {
  const calls = [];
  const api = createPostgresEventApi({
    db: { query: async q => {
      calls.push(q);
      return { rows: [{ receipt_id: receipt, choice: 'yes', saved_at: savedAt }] };
    } },
    authenticate: async () => ({ userId: host }),
    rateLimitRsvp: async () => true,
    rateLimitInbox: async () => true,
    authorizeRecipient: async () => true,
    loadInvite: async () => ({ id: invite, ownerUserId: host, deletedAt: null })
  });
  const response = await api(new Request('https://example.test/api/host-inbox?inviteId=' + invite + '&limit=10'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { responses: [{ receiptId: receipt, choice: 'yes', savedAt }] });
  assert.deepEqual(calls[0].values, [host, invite, 10]);
});
