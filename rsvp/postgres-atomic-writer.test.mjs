import test from 'node:test';
import assert from 'node:assert/strict';
import { createAtomicRsvpWriter } from './postgres-atomic-writer.mjs';
const ids = ['123e4567-e89b-42d3-a456-426614174003','123e4567-e89b-42d3-a456-426614174000','123e4567-e89b-42d3-a456-426614174001','123e4567-e89b-42d3-a456-426614174002'];
const input = {userId:ids[0],inviteId:ids[1],recipientId:ids[2],challengeId:ids[3],idempotencyKey:'a'.repeat(64),choice:'yes'};
test('private writer binds verified user identity and inputs as parameters', async () => {
  let query;
  const writer = createAtomicRsvpWriter({query: async q => {
    query = q;
    return {rows:[{receipt_id:ids[3],saved_choice:'yes',saved_at:new Date('2026-11-07T12:00:00Z')}]};
  }});
  assert.deepEqual(await writer(input), {receiptId:ids[3],choice:'yes',savedAt:'2026-11-07T12:00:00.000Z'});
  assert.match(query.text, /cnidaria_internal\.submit_beta_rsvp/);
  assert.deepEqual(query.values, [...ids,'a'.repeat(64),'yes']);
  assert.ok(!query.text.includes(ids[0]));
});
test('invalid identity and replay key never reach database', async () => {
  let count=0;
  const writer=createAtomicRsvpWriter({query:async()=>{count++;return {rows:[]}}});
  await assert.rejects(writer({...input,userId:'attacker'}));
  await assert.rejects(writer({...input,idempotencyKey:'bad'}));
  assert.equal(count,0);
});
test('empty, mismatched and malformed database receipts fail closed', async () => {
  for(const rows of [[],[{receipt_id:ids[3],saved_choice:'no',saved_at:'2026-11-07T12:00:00Z'}],
    [{receipt_id:'bad',saved_choice:'yes',saved_at:'2026-11-07T12:00:00Z'}],
    [{receipt_id:ids[3],saved_choice:'yes',saved_at:'invalid'}]]) {
    await assert.rejects(createAtomicRsvpWriter({query:async()=>({rows})})(input));
  }
});
test('database errors do not return success',async()=>{
  await assert.rejects(createAtomicRsvpWriter({query:async()=>{throw Error('db down')}})(input));
});
