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
