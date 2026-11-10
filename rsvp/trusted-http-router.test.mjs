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
    new Request('https://example.test/api/host-inbox?inviteId=123e4567-e89b-42d3-a456-426614174000&limit=25'));
  assert.equal(response.status, 200);
  assert.deepEqual(seen.query, { inviteId: '123e4567-e89b-42d3-a456-426614174000', limit: 25 });
});
test('rejects oversized streamed body, wrong content type and duplicate parameters', async () => {
  const router = make();
  assert.equal((await router(post(' '.repeat(8193)))).status, 403);
  assert.equal((await router(post('{}', { 'Content-Type': 'text/plain' }))).status, 403);
  assert.equal((await router(new Request('https://example.test/api/host-inbox?inviteId=123e4567-e89b-42d3-a456-426614174000&inviteId=123e4567-e89b-42d3-a456-426614174000&limit=2'))).status, 403);
  assert.equal((await router(new Request('https://example.test/api/host-inbox?inviteId=123e4567-e89b-42d3-a456-426614174000&limit=2&admin=true'))).status, 403);
});
test('fails closed on malformed JSON, exceptions, and non-success handlers', async () => {
  assert.equal((await make()(post('{'))).status, 403);
  assert.equal((await make(async () => { throw Error('secret'); })(post('{}'))).status, 403);
  assert.equal((await make(async () => ({ status: 403, body: { error: 'private' } }))(post('{}'))).status, 403);
});

test('accepts valid numeric Content-Length and one/two digit inbox limits', async () => {
  const router = make();
  assert.equal((await router(post('{}', { 'Content-Length': '2' }))).status, 200);
  for (const limit of ['1', '9', '10', '25', '50']) {
    const response = await router(new Request('https://example.test/api/host-inbox?inviteId=123e4567-e89b-42d3-a456-426614174000&limit=' + limit));
    assert.equal(response.status, 200, 'limit ' + limit);
  }
  for (const limit of ['0', '51', '99', '100', '1a', '-1']) {
    const response = await router(new Request('https://example.test/api/host-inbox?inviteId=123e4567-e89b-42d3-a456-426614174000&limit=' + limit));
    assert.equal(response.status, 403, 'limit ' + limit);
  }
});

test('rejects Content-Length mismatches before trusted handler invocation', async () => {
  let calls = 0;
  const router = make(async () => { calls++; return ok; });
  assert.equal((await router(post('{}', { 'Content-Length': '1' }))).status, 403);
  assert.equal((await router(post('{}', { 'Content-Length': '3' }))).status, 403);
  assert.equal(calls, 0);
  assert.equal((await router(post('{}', { 'Content-Length': '2' }))).status, 200);
  assert.equal(calls, 1);
});

test('rejects URL credentials, fragments and RSVP query parameters before handler invocation', async () => {
  let calls = 0;
  const router = make(async () => { calls++; return ok; }, async () => { calls++; return { status: 200, body: { responses: [] } }; });
  for (const url of [
    'https://example.test/api/rsvp?recipient=spoofed',
    'https://example.test/api/rsvp?choice=yes',
    'https://example.test/api/rsvp#receipt',
  ]) {
    assert.equal((await router(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }))).status, 403, url);
  }
  // Node's Request constructor itself rejects credential-bearing URLs. Simulate
  // a runtime-provided Request with an unsafe URL to exercise router defense.
  const withCredentials = (url, init) => {
    const request = new Request(url.replace('user:pass@', ''), init);
    Object.defineProperty(request, 'url', { value: url });
    return request;
  };
  assert.equal((await router(withCredentials('https://user:pass@example.test/api/rsvp', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  }))).status, 403);
  assert.equal((await router(withCredentials('https://user:pass@example.test/api/host-inbox?inviteId=123e4567-e89b-42d3-a456-426614174000&limit=1'))).status, 403);
  assert.equal(calls, 0);
  assert.equal((await router(post('{}'))).status, 200);
  assert.equal(calls, 1);
});

test('rejects malformed host inbox invitation IDs before trusted handler invocation', async () => {
  let calls = 0;
  const router = make(undefined, async () => { calls++; return { status: 200, body: { responses: [] } }; });
  for (const inviteId of ['abc', 'null', '123e4567-e89b-42d3-a456-42661417400g', '',
    '123e4567-e89b-02d3-a456-426614174000', // invalid UUID version
    '123e4567-e89b-42d3-7456-426614174000' // invalid UUID variant
  ]) {
    const response = await router(new Request('https://example.test/api/host-inbox?inviteId=' + inviteId + '&limit=25'));
    assert.equal(response.status, 403, inviteId);
  }
  assert.equal(calls, 0);
  assert.equal((await router(new Request('https://example.test/api/host-inbox?inviteId=123e4567-e89b-42d3-a456-426614174000&limit=25'))).status, 200);
  assert.equal(calls, 1);
});

test('rejects encoded RSVP payloads and framed inbox GETs before trusted handlers', async () => {
  let calls = 0;
  const router = make(async () => { calls++; return ok; }, async () => {
    calls++; return { status: 200, body: { responses: [] } };
  });
  for (const encoding of ['gzip', 'br', 'deflate']) {
    assert.equal((await router(post('{}', { 'Content-Encoding': encoding }))).status, 403);
  }
  const inboxUrl = 'https://example.test/api/host-inbox?inviteId=123e4567-e89b-42d3-a456-426614174000&limit=25';
  assert.equal((await router(new Request(inboxUrl, { headers: { 'Content-Length': '2' } }))).status, 403);
  assert.equal((await router(new Request(inboxUrl, { headers: { 'Transfer-Encoding': 'chunked' } }))).status, 403);
  assert.equal(calls, 0);
  assert.equal((await router(post('{}', { 'Content-Encoding': 'identity' }))).status, 200);
  assert.equal((await router(new Request(inboxUrl))).status, 200);
  assert.equal(calls, 2);
});

test('rejects transfer-encoded RSVP framing before handler invocation', async () => {
  let calls = 0;
  const router = make(async () => { calls++; return ok; });
  for (const headers of [
    { 'Transfer-Encoding': 'chunked' },
    { 'Transfer-Encoding': 'chunked', 'Content-Length': '2' },
    { 'Transfer-Encoding': 'gzip, chunked' },
  ]) {
    assert.equal((await router(post('{}', headers))).status, 403);
  }
  assert.equal(calls, 0);
  assert.equal((await router(post('{}'))).status, 200);
  assert.equal(calls, 1);
});

test('accepts only unambiguous UTF-8 JSON media types before RSVP handler', async () => {
  let calls = 0;
  const router = make(async () => { calls++; return ok; });
  for (const type of [
    'application/json; charset=iso-8859-1',
    'application/json; charset=utf-8; charset=latin1',
    'application/json; profile=unsafe',
    'application/json; charset=',
    'application/json; charset=utf-16'
  ]) {
    assert.equal((await router(post('{}', { 'Content-Type': type }))).status, 403, type);
  }
  assert.equal(calls, 0);
  for (const type of ['application/json', 'application/json; charset=utf-8', 'application/json; charset="UTF-8"']) {
    assert.equal((await router(post('{}', { 'Content-Type': type }))).status, 200, type);
  }
  assert.equal(calls, 3);
});

test('rejects non-object JSON RSVP payloads before invoking trusted handler', async () => {
  let calls = 0;
  const router = make(async () => { calls++; return ok; });
  for (const payload of ['null', '[]', '[{"choice":"yes"}]', 'true', '42', '"yes"']) {
    assert.equal((await router(post(payload))).status, 403, payload);
  }
  assert.equal(calls, 0);
  assert.equal((await router(post('{"choice":"yes"}'))).status, 200);
  assert.equal(calls, 1);
});

test('rejects cross-origin RSVP browser submissions before trusted handler invocation', async () => {
  let calls = 0;
  const router = make(async () => { calls++; return ok; });
  for (const origin of ['https://evil.test', 'null', 'http://example.test', 'https://example.test.evil.test']) {
    assert.equal((await router(post('{}', { Origin: origin }))).status, 403, origin);
  }
  assert.equal(calls, 0);
  assert.equal((await router(post('{}', { Origin: 'https://example.test' }))).status, 200);
  assert.equal((await router(post('{}'))).status, 200);
  assert.equal(calls, 2);
});

test('rejects cross-origin private host inbox requests before trusted reader invocation', async () => {
  let calls = 0;
  const router = make(undefined, async () => {
    calls++;
    return { status: 200, body: { responses: [] } };
  });
  const url = 'https://example.test/api/host-inbox?inviteId=123e4567-e89b-42d3-a456-426614174000&limit=25';
  for (const origin of ['https://evil.test', 'null', 'http://example.test', 'https://example.test.evil.test']) {
    assert.equal((await router(new Request(url, { headers: { Origin: origin } }))).status, 403, origin);
  }
  assert.equal(calls, 0);
  assert.equal((await router(new Request(url, { headers: { Origin: 'https://example.test' } }))).status, 200);
  assert.equal((await router(new Request(url))).status, 200);
  assert.equal(calls, 2);
});

test('rejects cross-site Fetch Metadata even without Origin on RSVP and inbox', async () => {
  let calls = 0;
  const router = make(async () => { calls++; return ok; }, async () => {
    calls++;
    return { status: 200, body: { responses: [] } };
  });
  const inbox = 'https://example.test/api/host-inbox?inviteId=123e4567-e89b-42d3-a456-426614174000&limit=25';
  for (const site of ['cross-site', 'same-site', 'invalid']) {
    assert.equal((await router(post('{}', { 'Sec-Fetch-Site': site }))).status, 403, site);
    assert.equal((await router(new Request(inbox, { headers: { 'Sec-Fetch-Site': site } }))).status, 403, site);
  }
  assert.equal(calls, 0);
  for (const site of ['same-origin', 'none']) {
    assert.equal((await router(post('{}', { 'Sec-Fetch-Site': site }))).status, 200, site);
    assert.equal((await router(new Request(inbox, { headers: { 'Sec-Fetch-Site': site } }))).status, 200, site);
  }
  assert.equal(calls, 4);
});

test('rejects document navigation metadata before RSVP or inbox handlers', async () => {
  let calls = 0;
  const router = make(async () => { calls++; return ok; }, async () => {
    calls++; return { status: 200, body: { responses: [] } };
  });
  const inbox = 'https://example.test/api/host-inbox?inviteId=123e4567-e89b-42d3-a456-426614174000&limit=25';
  for (const site of ['none', 'same-origin']) {
    assert.equal((await router(post('{}', {
      'Sec-Fetch-Site': site, 'Sec-Fetch-Mode': 'navigate'
    }))).status, 403);
    assert.equal((await router(new Request(inbox, { headers: {
      'Sec-Fetch-Site': site, 'Sec-Fetch-Mode': 'navigate'
    } }))).status, 403);
  }
  assert.equal(calls, 0);
  assert.equal((await router(post('{}', {
    'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors'
  }))).status, 200);
  assert.equal((await router(new Request(inbox, { headers: {
    'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors'
  } }))).status, 200);
  assert.equal(calls, 2);
});

test('rejects opaque or unexpected browser fetch modes before private handlers', async () => {
  let calls = 0;
  const router = make(async () => { calls++; return ok; }, async () => {
    calls++; return { status: 200, body: { responses: [] } };
  });
  const inbox = 'https://example.test/api/host-inbox?inviteId=123e4567-e89b-42d3-a456-426614174000&limit=25';
  for (const mode of ['no-cors', 'navigate', 'websocket', 'invalid']) {
    assert.equal((await router(post('{}', { 'Sec-Fetch-Mode': mode }))).status, 403, mode);
    assert.equal((await router(new Request(inbox, { headers: { 'Sec-Fetch-Mode': mode } }))).status, 403, mode);
  }
  assert.equal(calls, 0);
  for (const mode of ['cors', 'same-origin']) {
    assert.equal((await router(post('{}', { 'Sec-Fetch-Mode': mode }))).status, 200, mode);
    assert.equal((await router(new Request(inbox, { headers: { 'Sec-Fetch-Mode': mode } }))).status, 200, mode);
  }
  assert.equal(calls, 4);
});

test('private API responses prevent MIME sniffing and referrer disclosure on success and denial', async () => {
  const router = make();
  for (const request of [post('{}'), post('{'),
    new Request('https://example.test/api/host-inbox?inviteId=123e4567-e89b-42d3-a456-426614174000&limit=25'),
    new Request('https://example.test/api/host-inbox?inviteId=invalid&limit=25')]) {
    const response = await router(request);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});
