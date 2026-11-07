import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrustedHostInboxClient } from './trusted-host-inbox-client.mjs';

const inviteId = '123e4567-e89b-42d3-a456-426614174000';

test('malformed host bearer credentials never reach the network', async () => {
  let calls = 0;
  for (const token of ['', ' token', 'token ', 'a b', 'a\\tb', 'a\\nb', 'é', 'x'.repeat(8193)]) {
    const read = createTrustedHostInboxClient({
      getAccessToken: async () => token,
      fetcher: async () => { calls++; throw Error('must not send'); }
    });
    await assert.rejects(read(inviteId), /Host authentication required/);
  }
  assert.equal(calls, 0);
});

test('valid host bearer token reaches only same-origin inbox', async () => {
  let calls = 0;
  const read = createTrustedHostInboxClient({
    getAccessToken: async () => 'valid-token',
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, '/api/host-inbox?inviteId=' + inviteId + '&limit=25');
      assert.equal(options.headers.Authorization, 'Bearer valid-token');
      assert.equal(options.credentials, 'same-origin');
      return { ok: true, status: 200, json: async () => ({ responses: [] }) };
    }
  });
  assert.deepEqual(await read(inviteId), []);
  assert.equal(calls, 1);
});
