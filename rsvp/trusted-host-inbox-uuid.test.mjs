import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrustedHostInboxClient } from './trusted-host-inbox-client.mjs';

test('host inbox rejects UUIDs with invalid version or variant before authentication or fetch', async () => {
  let authCalls = 0;
  let fetchCalls = 0;
  const inbox = createTrustedHostInboxClient({
    getAccessToken: async () => { authCalls++; return 'valid-token'; },
    fetcher: async () => { fetchCalls++; throw new Error('should not fetch'); }
  });
  for (const inviteId of [
    '12345678-1234-0234-8234-123456789abc',
    '12345678-1234-4234-7234-123456789abc',
    '12345678-1234-4234-c234-123456789abc'
  ]) {
    await assert.rejects(inbox(inviteId), { name: 'TypeError', message: 'Invalid inbox query' });
  }
  assert.equal(authCalls, 0);
  assert.equal(fetchCalls, 0);
});
