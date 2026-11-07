import test from 'node:test';
import assert from 'node:assert/strict';
import { createRsvpHttpRouter } from './trusted-http-router.mjs';

const ok = { status: 200, body: { receiptId: 'receipt', choice: 'yes', savedAt: '2026-11-07T00:00:00Z' } };
const make = (submitRsvp = async () => ok, getHostInbox = async () => ({ status: 200, body: { responses: [] } })) =>
  createRsvpHttpRouter({ submitRsvp, getHostInbox });
const post = (body, headers = {}) => new Request('https://example.test/api/rsvp', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body
});
test('routes POST to trusted handler without treating body as identity', async () => {
  let seen;
  const response = await make(async input => { seen = input; return ok; })(post('{"choice":"yes","userId":"spoofed"}'));
  assert.equal(response.status, 200);
  assert.equal(seen.body.userId, 'spoofed');
  assert.equal(seen.userId, undefined);
  assert.equal(seen.rawRequest.method, 'POST');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('routes strict host inbox query', async () => {
  let seen;
  const response = await make(undefined, async input => { seen = input; return { status: 200, body: { responses: [] } }; })(
    new Request('https://example.test/api/host-inbox?inviteId=abc&limit=25'));
  assert.equal(response.status, 200);
  assert.deepEqual(seen.query, { inviteId: 'abc', limit: 25 });
});
test('rejects oversized streamed body, wrong content type and duplicate parameters', async () => {
  const router = make();
  assert.equal((await router(post(' '.repeat(8193)))).status, 403);
  assert.equal((await router(post('{}', { 'Content-Type': 'text/plain' }))).status, 403);
  assert.equal((await router(new Request('https://example.test/api/host-inbox?inviteId=a&inviteId=b&limit=2'))).status, 403);
  assert.equal((await router(new Request('https://example.test/api/host-inbox?inviteId=a&limit=2&admin=true'))).status, 403);
});
test('fails closed on malformed JSON, exceptions, and non-success handlers', async () => {
  assert.equal((await make()(post('{'))).status, 403);
  assert.equal((await make(async () => { throw Error('secret'); })(post('{}'))).status, 403);
  assert.equal((await make(async () => ({ status: 403, body: { error: 'private' } }))(post('{}'))).status, 403);
});
