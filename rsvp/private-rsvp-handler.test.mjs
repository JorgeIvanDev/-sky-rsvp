import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateRsvpHandler } from './private-rsvp-handler.mjs';

const input = { inviteId:'123e4567-e89b-42d3-a456-426614174000',
 recipientId:'123e4567-e89b-42d3-a456-426614174001',
 challengeId:'123e4567-e89b-42d3-a456-426614174002',
 idempotencyKey:'a'.repeat(64), choice:'yes' };
const identity = { userId:'server-verified-user' };
const make = (overrides={}) => {
 const calls=[];
 const deps={
  authenticate:async()=>{calls.push('auth');return identity;},
  rateLimit:async()=>{calls.push('limit');return true;},
  authorizeRecipient:async()=>{calls.push('authorize');return true;},
  submitAtomic:async payload=>{calls.push('submit');assert.equal(payload.userId,identity.userId);
   return {receiptId:'receipt',choice:'yes',savedAt:'2026-11-06T23:00:00Z'};},
  ...overrides
 };
 return { handler:createPrivateRsvpHandler(deps),calls };
};
test('authorized RSVP produces minimal receipt after ordered security gates',async()=>{
 const {handler,calls}=make();
 assert.deepEqual(await handler({method:'POST',body:input}),{
  status:200,body:{receiptId:'receipt',choice:'yes',savedAt:'2026-11-06T23:00:00Z'}});
 assert.deepEqual(calls,['auth','limit','authorize','submit']);
});
test('denied rate limit never authorizes or writes',async()=>{
 const {handler,calls}=make({rateLimit:async()=>{calls.push('limit');return false;}});
 assert.equal((await handler({method:'POST',body:input})).status,403);
 assert.deepEqual(calls,['auth','limit']);
});
test('unauthorized recipient never reaches transaction',async()=>{
 const {handler,calls}=make({authorizeRecipient:async()=>{calls.push('authorize');return false;}});
 assert.equal((await handler({method:'POST',body:input})).status,403);
 assert.deepEqual(calls,['auth','limit','authorize']);
});
test('request-supplied identity is ignored and invalid payload is denied',async()=>{
 const {handler,calls}=make();
 assert.equal((await handler({method:'POST',body:{...input,userId:'attacker'}})).status,403);
 assert.deepEqual(calls,['auth','limit']);
});
test('malformed receipt and thrown dependency fail closed',async()=>{
 const {handler}=make({submitAtomic:async()=>({receiptId:'r',choice:'no',savedAt:'now'})});
 assert.equal((await handler({method:'POST',body:input})).status,403);
 const {handler:broken}=make({authenticate:async()=>{throw Error('secret');}});
 assert.deepEqual(await broken({method:'POST',body:input}),{status:403,body:{error:'RSVP unavailable'}});
});

test('blank authenticated principal fails closed before rate limit and DB access',async()=>{
 for (const userId of ['', ' ', '\t']) {
  const {handler,calls}=make({authenticate:async()=>{calls.push('auth');return {userId};}});
  assert.deepEqual(await handler({method:'POST',body:input}),
   {status:403,body:{error:'RSVP unavailable'}});
  assert.deepEqual(calls,['auth']);
 }
});

test('blank receipt identifiers and invalid saved timestamps fail closed',async()=>{
 for (const receipt of [
  {receiptId:' ',choice:'yes',savedAt:'2026-11-06T23:00:00Z'},
  {receiptId:'receipt',choice:'yes',savedAt:'not-a-date'},
  {receiptId:'receipt',choice:'yes',savedAt:''}
 ]) {
  const {handler}=make({submitAtomic:async()=>receipt});
  assert.deepEqual(await handler({method:'POST',body:input}),
   {status:403,body:{error:'RSVP unavailable'}});
 }
});

test('trusted transaction receipt rejects unsafe identifiers and non-UTC timestamps', async () => {
 const invalid = [
  {receiptId:'<script>',choice:'yes',savedAt:'2026-11-06T23:00:00Z'},
  {receiptId:'a'.repeat(129),choice:'yes',savedAt:'2026-11-06T23:00:00Z'},
  {receiptId:'receipt',choice:'yes',savedAt:'2026-11-06T23:00:00+01:00'},
  {receiptId:'receipt',choice:'yes',savedAt:'2026-11-06'},
  {receiptId:'receipt',choice:'yes',savedAt:'2026-11-06T23:00:00'},
 ];
 for (const receipt of invalid) {
  const {handler} = make({submitAtomic:async()=>receipt});
  assert.deepEqual(await handler({method:'POST',body:input}),
   {status:403,body:{error:'RSVP unavailable'}});
 }
});

test('trusted transaction rejects normalized impossible dates but accepts leap dates and milliseconds', async () => {
 for (const savedAt of ['2026-02-30T12:00:00Z', '2025-02-29T12:00:00Z',
   '2026-04-31T12:00:00.123Z']) {
  const {handler} = make({submitAtomic:async()=>({receiptId:'receipt',choice:'yes',savedAt})});
  assert.equal((await handler({method:'POST',body:input})).status,403);
 }
 for (const savedAt of ['2024-02-29T12:00:00Z','2026-11-06T23:00:00.123Z']) {
  const {handler} = make({submitAtomic:async()=>({receiptId:'receipt',choice:'yes',savedAt})});
  assert.equal((await handler({method:'POST',body:input})).status,200);
 }
});


test('trusted server rejects accessor-backed and inherited receipt fields', async () => {
 const valid = {receiptId:'receipt',choice:'yes',savedAt:'2026-11-06T23:00:00Z'};
 const malicious = [
  Object.defineProperty({...valid}, 'receiptId', {get(){throw Error('private adapter error');}}),
  Object.create(valid),
  Object.assign(Object.create({receiptId:'inherited'}), {choice:'yes',savedAt:valid.savedAt}),
  Object.assign(Object.create({}), valid)
 ];
 for (const receipt of malicious) {
  const {handler}=make({submitAtomic:async()=>receipt});
  assert.deepEqual(await handler({method:'POST',body:input}),
   {status:403,body:{error:'RSVP unavailable'}});
 }
});
