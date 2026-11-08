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
 for (const endpoint of ['https://example.org/rsvp', '//evil.example/rsvp', '/api/rsvp?token=secret']) {
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
 for (const token of [' token', 'token ', 'a b', 'a\tb', 'a\nb', 'é', 'x'.repeat(8193)]) {
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
