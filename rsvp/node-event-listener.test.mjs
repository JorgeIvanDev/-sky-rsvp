import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createNodeEventListener } from './node-event-listener.mjs';

async function invoke(method, path, headers = {}, body = '', rawHeaders) {
  const req = Object.assign(new EventEmitter(), { method, url: path, headers, rawHeaders,
    async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(body); } });
  const res = { headersSent: false, status: null, payload: '',
    writeHead(status, responseHeaders) { this.status = status; this.headers = responseHeaders; this.headersSent = true; },
    end(data) { this.payload = String(data || ''); },
    destroy() { throw new Error('Unexpected destroy'); } };
  let called = 0;
  const listener = createNodeEventListener(async request => {
    called++;
    return new Response(JSON.stringify({ ok: request.method === method }), { status: 200 });
  });
  await listener(req, res);
  return { res, called };
}

test('rejects absolute URLs before trusted routing', async () => {
  const { res, called } = await invoke('GET', 'https://attacker.example/api/host-inbox');
  assert.equal(res.status, 403);
  assert.equal(called, 0);
});

test('denied private API requests retain no-store and privacy headers', async () => {
  const { res, called } = await invoke('GET', 'https://attacker.example/api/host-inbox');
  assert.equal(called, 0);
  assert.equal(res.status, 403);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['referrer-policy'], 'no-referrer');
  assert.equal(res.headers['content-type'], 'application/json');
});

test('rejects ambiguous duplicated headers', async () => {
  const { res, called } = await invoke('GET', '/api/host-inbox', { authorization: ['a', 'b'] });
  assert.equal(res.status, 403);
  assert.equal(called, 0);
});

test('bridges a relative private API request without trusting host', async () => {
  const { res, called } = await invoke('GET', '/api/host-inbox?inviteId=x&limit=5', { host: 'attacker.example' });
  assert.equal(res.status, 200);
  assert.equal(called, 1);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('rejects conflicting message framing and encoded bodies before routing', async () => {
  for (const headers of [
    { 'content-length': '2', 'transfer-encoding': 'chunked' },
    { 'content-encoding': 'gzip' },
    { 'content-encoding': 'br' }
  ]) {
    const { res, called } = await invoke('POST', '/api/rsvp', headers, '{}');
    assert.equal(res.status, 403, JSON.stringify(headers));
    assert.equal(called, 0);
  }
  const accepted = await invoke('POST', '/api/rsvp', { 'content-encoding': 'identity' }, '{}');
  assert.equal(accepted.res.status, 200);
  assert.equal(accepted.called, 1);
});

test('rejects duplicate wire-level auth and framing headers before trusted routing', async () => {
  for (const name of ['Authorization', 'Cookie', 'Content-Length',
    'Transfer-Encoding', 'Content-Type', 'Content-Encoding']) {
    const { res, called } = await invoke('GET', '/api/host-inbox', {},
      '', [name, 'first', name.toLowerCase(), 'second']);
    assert.equal(res.status, 403, name);
    assert.equal(called, 0, name);
  }
  const allowed = await invoke('GET', '/api/host-inbox', { authorization: 'Bearer valid' },
    '', ['Authorization', 'Bearer valid', 'Accept', 'application/json']);
  assert.equal(allowed.res.status, 200);
  assert.equal(allowed.called, 1);
});

test('rejects malformed raw wire header names before private routing', async () => {
  for (const name of ['Authorization ', ' Authorization', 'Authorization\t', 'Auth\u00e9rization', 'Bad Header', 'X-Header\nInjected']) {
    const { res, called } = await invoke('GET', '/api/host-inbox', {},
      '', [name, 'value']);
    assert.equal(res.status, 403, JSON.stringify(name));
    assert.equal(called, 0, JSON.stringify(name));
  }
});

test('configured public origin supports real browser same-origin requests without trusting Host', async () => {
  const req = Object.assign(new EventEmitter(), {
    method: 'GET', url: '/api/host-inbox?inviteId=123e4567-e89b-42d3-a456-426614174000&limit=1',
    headers: { host: 'attacker.example', origin: 'https://invite.example' },
    async *[Symbol.asyncIterator]() {}
  });
  const res = { headersSent: false, writeHead(status) { this.status = status; this.headersSent = true; },
    end() {}, destroy() { throw Error('unexpected destroy'); } };
  const { createRsvpHttpRouter } = await import('./trusted-http-router.mjs');
  const router = createRsvpHttpRouter({
    submitRsvp: async () => ({ status: 403 }),
    getHostInbox: async () => ({ status: 200, body: { responses: [] } })
  });
  await createNodeEventListener(router, { publicOrigin: 'https://invite.example' })(req, res);
  assert.equal(res.status, 200);
});

test('rejects invalid trusted public origin at construction', () => {
  for (const publicOrigin of ['javascript:alert(1)', 'https://user:pass@example.test',
    'https://example.test/path', 'https://example.test/?token=secret']) {
    assert.throws(() => createNodeEventListener(async () => new Response(), { publicOrigin }), TypeError);
  }
});

test('rejects oversized or ambiguous declared body lengths before routing', async () => {
  for (const value of ['16385', '9999999999999999999999', '-1', '+2', '02', '1.5', 'NaN']) {
    const { res, called } = await invoke('POST', '/api/rsvp', { 'content-length': value }, '{}');
    assert.equal(res.status, 403, value);
    assert.equal(called, 0, value);
  }
  const { res, called } = await invoke('POST', '/api/rsvp', { 'content-length': '2' }, '{}');
  assert.equal(res.status, 200);
  assert.equal(called, 1);
});

test('rejects oversized streamed POST even without declared length', async () => {
  for (const headers of [{}, { 'transfer-encoding': 'chunked' }]) {
    const { res, called } = await invoke('POST', '/api/rsvp', headers, 'x'.repeat(16385));
    assert.equal(res.status, 403);
    assert.equal(called, 0);
  }
});

test('rejects declared length mismatch before private routing', async () => {
  for (const length of ['1', '3']) {
    const { res, called } = await invoke('POST', '/api/rsvp', { 'content-length': length }, '{}');
    assert.equal(res.status, 403);
    assert.equal(called, 0);
  }
});

test('accepts a streamed POST at the exact 16 KiB boundary', async () => {
  const { res, called } = await invoke('POST', '/api/rsvp',
    { 'transfer-encoding': 'chunked' }, 'x'.repeat(16384));
  assert.equal(res.status, 200);
  assert.equal(called, 1);
});
