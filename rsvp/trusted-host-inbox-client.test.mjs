import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrustedHostInboxClient } from './trusted-host-inbox-client.mjs';

const id = '12345678-1234-4234-8234-123456789abc';
const row = { receiptId: 'receipt-1', choice: 'yes', savedAt: '2026-11-07T00:00:00Z' };

test('host inbox uses same-origin authenticated GET and projects private response fields', async () => {
  let calls = 0;
  const client = createTrustedHostInboxClient({
    getAccessToken: async () => 'token',
    fetcher: async (url, init) => {
      calls++;
      assert.equal(url, '/api/host-inbox?inviteId=' + id + '&limit=25');
      assert.equal(init.method, 'GET');
      assert.equal(init.credentials, 'same-origin');
      assert.equal(init.redirect, 'error');
      assert.equal(init.cache, 'no-store');
      assert.equal(init.headers.Authorization, 'Bearer token');
      return { ok: true, status: 200, json: async () => ({ responses: [{ ...row, privateEmail: 'hidden' }] }) };
    }
  });
  assert.deepEqual(await client(id), [row]);
  assert.equal(calls, 1);
});

test('rejects unsafe endpoint, invalid query and missing authentication before fetch', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; throw Error('must not fetch'); };
  assert.throws(() => createTrustedHostInboxClient({ fetcher, getAccessToken: async () => 't', endpoint: '//evil' }));
  const client = createTrustedHostInboxClient({ fetcher, getAccessToken: async () => '  ' });
  await assert.rejects(client(id), /authentication/);
  await assert.rejects(client('../unsafe'), /Invalid inbox query/);
  await assert.rejects(client(id, 51), /Invalid inbox query/);
  assert.equal(calls, 0);
});

test('rejects failed responses, malformed data and excess rows', async () => {
  for (const response of [
    { ok: false, status: 403 },
    { ok: true, status: 200, json: async () => ({ responses: [ { ...row, savedAt: 'bad' } ] }) },
    { ok: true, status: 200, json: async () => ({ responses: [row, row] }) },
    { ok: true, status: 200, json: async () => ({ responses: 'invalid' }) }
  ]) {
    const client = createTrustedHostInboxClient({ fetcher: async () => response, getAccessToken: async () => 'token' });
    await assert.rejects(client(id, 1), /Inbox unavailable/);
  }
});


test('rejects duplicate receipt IDs instead of showing ambiguous host responses', async () => {
  const client = createTrustedHostInboxClient({
    getAccessToken: async () => 'token',
    fetcher: async () => ({
      ok: true, status: 200,
      json: async () => ({ responses: [row, { ...row, choice: 'no' }] })
    })
  });
  await assert.rejects(client(id, 2), /Inbox unavailable/);
});

test('rejects unsafe receipt identifiers and ambiguous host inbox timestamps', async () => {
  const invalidRows = [
    ...['', ' ', ' receipt', 'receipt\\nnext', '<script>', 'a'.repeat(129), 'é']
      .map(receiptId => ({ ...row, receiptId })),
    ...['2026-11-07', '2026-11-07T00:00:00+01:00',
      '2026-11-07T00:00:00', '2026-11-07T00:00:00.1234Z']
      .map(savedAt => ({ ...row, savedAt }))
  ];
  for (const invalidRow of invalidRows) {
    const client = createTrustedHostInboxClient({
      getAccessToken: async () => 'token',
      fetcher: async () => ({
        ok: true, status: 200,
        json: async () => ({ responses: [invalidRow] })
      })
    });
    await assert.rejects(client(id), /Inbox unavailable/);
  }
});
