import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrustedRsvpClient } from './trusted-client.mjs';

const input = {
 inviteId:'123e4567-e89b-42d3-a456-426614174000',
 recipientId:'123e4567-e89b-42d3-a456-426614174001',
 challengeId:'123e4567-e89b-42d3-a456-426614174002',
 idempotencyKey:'a'.repeat(64), choice:'yes'
};
test('posts only validated RSVP data to same-origin trusted API and returns receipt', async () => {
 let called = 0;
 const submit = createTrustedRsvpClient({
   getAccessToken: async () => 'short-lived-token',
   fetcher: async (url, options) => {
     called++;
     assert.equal(url, '/api/rsvp');
     assert.equal(options.method, 'POST');
     assert.equal(options.mode, 'same-origin');
     assert.equal(options.credentials, 'same-origin');
     assert.equal(options.redirect, 'error');
     assert.equal(options.cache, 'no-store');
     assert.equal(options.headers.Authorization, 'Bearer short-lived-token');
     assert.deepEqual(JSON.parse(options.body), input);
     return { ok:true, status:200, json:async () => ({
       receiptId:'receipt-1', choice:'yes', savedAt:'2026-11-07T03:00:00Z'
     }) };
   }
 });
 assert.deepEqual(await submit(input), {
   receiptId:'receipt-1', choice:'yes', savedAt:'2026-11-07T03:00:00Z'
 });
 assert.equal(called,1);
});
test('rejects external endpoints and missing authentication without network request', async () => {
 for (const endpoint of ['https://example.org/rsvp', '//evil.example/rsvp', '/api/rsvp?token=secret', '/api/../evil', '/api/./rsvp', '/api/../../rsvp', '/api/other', '/api/host-inbox']) {
   assert.throws(() => createTrustedRsvpClient({fetcher:async()=>{},getAccessToken:async()=>'',endpoint}));
 }
 let calls=0;
 const submit=createTrustedRsvpClient({fetcher:async()=>{calls++;},getAccessToken:async()=>''});
 await assert.rejects(submit(input),/authentication required/);
 assert.equal(calls,0);
});
test('rejects untrusted payload and malformed server receipts', async () => {
 let calls=0;
 const submit=createTrustedRsvpClient({
   getAccessToken:async()=> 'token',
   fetcher:async()=>{calls++;return {ok:true,status:200,json:async()=>({
     receiptId:' ',choice:'yes',savedAt:'2026-11-07T03:00:00Z'
   })};}
 });
 await assert.rejects(submit({...input,userId:'forged'}),/Invalid RSVP submission/);
 assert.equal(calls,0);
 await assert.rejects(submit(input),/RSVP unavailable/);
 assert.equal(calls,1);
});

test('rejects malformed bearer credentials without transmitting an RSVP', async () => {
 let calls=0;
 for (const token of ['', ' token', 'token ', 'a b', 'a\tb', 'a\nb', 'é', 'token,other', 'token:other', 'token;other', 'token=other', 'x'.repeat(8193)]) {
   const submit=createTrustedRsvpClient({
     getAccessToken:async()=>token,
     fetcher:async()=>{calls++;throw Error('must not send');}
   });
   await assert.rejects(submit(input),/authentication required/);
 }
 assert.equal(calls,0);
});

test('rejects ambiguous or non-UTC receipt timestamps from the trusted endpoint', async () => {
 for (const savedAt of ['2026-11-07', 'Sat, 07 Nov 2026 03:00:00 GMT',
   '2026-11-07T03:00:00+01:00', '2026-11-07T03:00:00',
   '2026-11-07T03:00:00.1234Z', 'not-a-date']) {
   const submit = createTrustedRsvpClient({
     getAccessToken: async () => 'token',
     fetcher: async () => ({ok:true,status:200,json:async()=>({
       receiptId:'receipt-1',choice:'yes',savedAt
     })})
   });
   await assert.rejects(submit(input), /RSVP unavailable/);
 }
});

test('rejects unsafe, oversized or whitespace receipt identifiers', async () => {
 for (const receiptId of ['', ' ', ' receipt', 'receipt\nnext', '<script>', 'a'.repeat(129), 'é']) {
   const submit = createTrustedRsvpClient({
     getAccessToken: async () => 'token',
     fetcher: async () => ({ok:true,status:200,json:async()=>({
       receiptId, choice:'yes', savedAt:'2026-11-07T03:00:00Z'
     })})
   });
   await assert.rejects(submit(input), /RSVP unavailable/);
 }
});

test('rejects impossible UTC calendar dates without rejecting valid fractional precision', async () => {
 for (const savedAt of ['2026-02-30T03:00:00Z', '2026-11-31T03:00:00Z',
   '2026-13-01T03:00:00Z', '2026-02-29T03:00:00Z']) {
   const submit = createTrustedRsvpClient({
     getAccessToken: async () => 'token',
     fetcher: async () => ({ok:true,status:200,json:async()=>({
       receiptId:'receipt-1',choice:'yes',savedAt
     })})
   });
   await assert.rejects(submit(input), /RSVP unavailable/);
 }
 for (const savedAt of ['2024-02-29T03:00:00Z', '2026-11-07T03:00:00.1Z',
   '2026-11-07T03:00:00.12Z', '2026-11-07T03:00:00.123Z']) {
   const submit = createTrustedRsvpClient({
     getAccessToken: async () => 'token',
     fetcher: async () => ({ok:true,status:200,json:async()=>({
       receiptId:'receipt-1',choice:'yes',savedAt
     })})
   });
   assert.equal((await submit(input)).savedAt, savedAt);
 }
});

test('serializes RSVP submissions and permits retry after completion or failure', async () => {
 let release;
 let calls = 0;
 const submit = createTrustedRsvpClient({
   getAccessToken: async () => 'token',
   fetcher: async () => {
     calls++;
     if (calls === 1) await new Promise(resolve => { release = resolve; });
     return {ok:true,status:200,json:async()=>({
       receiptId:'receipt-1',choice:'yes',savedAt:'2026-11-07T03:00:00Z'
     })};
   }
 });
 const first = submit(input);
 // Allow the first invocation to reach the asynchronous network boundary.
 await Promise.resolve();
 await Promise.resolve();
 await assert.rejects(submit(input), /already in progress/);
 assert.equal(calls, 1);
 release();
 await first;
 await submit(input);
 assert.equal(calls, 2);

 let failCalls = 0;
 const failing = createTrustedRsvpClient({
   getAccessToken: async () => 'token',
   fetcher: async () => {
     failCalls++;
     if (failCalls === 1) throw Error('network offline');
     return {ok:true,status:200,json:async()=>({
       receiptId:'receipt-2',choice:'yes',savedAt:'2026-11-07T03:00:00Z'
     })};
   }
 });
 await assert.rejects(failing(input), /RSVP unavailable/);
 assert.equal((await failing(input)).receiptId, 'receipt-2');
 assert.equal(failCalls, 2);
});

test('does not leak upstream JSON parse errors or response content to guests', async () => {
 const submit = createTrustedRsvpClient({
   getAccessToken: async () => 'token',
   fetcher: async () => ({ok:true,status:200,json:async()=>{
     throw new SyntaxError('private upstream response: secret');
   }})
 });
 await assert.rejects(submit(input), error => {
   assert.equal(error.message, 'RSVP unavailable');
   assert.equal(error.message.includes('secret'), false);
   return true;
 });
});

test('redacts transport exceptions while allowing retry', async () => {
 let calls = 0;
 const submit = createTrustedRsvpClient({
   getAccessToken: async () => 'token',
   fetcher: async () => {
     calls++;
     if (calls === 1) throw new Error('private gateway hostname and secret');
     return {ok:true,status:200,json:async()=>({receiptId:'receipt-3',choice:'yes',savedAt:'2026-11-07T03:00:00Z'})};
   }
 });
 await assert.rejects(submit(input), error => {
   assert.equal(error.message, 'RSVP unavailable');
   return true;
 });
 assert.equal((await submit(input)).receiptId, 'receipt-3');
 assert.equal(calls, 2);
});

test('redacts auth provider exceptions and never contacts RSVP API', async () => {
 let calls = 0;
 const submit = createTrustedRsvpClient({
   getAccessToken: async () => { throw new Error('private session secret and auth endpoint'); },
   fetcher: async () => { calls++; throw new Error('must not send'); }
 });
 await assert.rejects(submit(input), error => {
   assert.equal(error.message, 'RSVP authentication required');
   return true;
 });
 assert.equal(calls, 0);
});
