import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ReferenceChallengeStore} from './atomic-challenge-reference.mjs';

const challenge = () => ({id:'c',recipientId:'r',inviteId:'i',nonce:'n',expiresAt:500});
const request = (verified=true) => ({challengeId:'c',recipientId:'r',inviteId:'i',nonce:'n',now:100,verified});

test('concurrent requests cannot unlock twice within the reference process', async () => {
  const store = new ReferenceChallengeStore([challenge()]);
  const results = await Promise.all(Array.from({length:50}, () => Promise.resolve().then(() => store.consume(request()))));
  assert.equal(results.filter(r=>r.ok).length,1);
  assert.deepEqual(store.snapshot('c'),{consumed:true,unlocked:true});
});
test('failed participation spends the sole attempt', () => {
  const store = new ReferenceChallengeStore([challenge()]);
  assert.equal(store.consume(request(false)).ok,false);
  assert.equal(store.consume(request(true)).reason,'consumed');
  assert.deepEqual(store.snapshot('c'),{consumed:true,unlocked:false});
});
test('wrong binding, revoked, expired and malformed requests never unlock', () => {
  for (const invalid of [{recipientId:'other'},{inviteId:'other'},{nonce:'other'},{now:501},{verified:'true'},{challengeId:'other'}]) {
    const store = new ReferenceChallengeStore([challenge()]);
    assert.equal(store.consume({...request(),...invalid}).ok,false);
    assert.deepEqual(store.snapshot('c'),{consumed:false,unlocked:false});
  }
  const revoked = new ReferenceChallengeStore([{...challenge(),revoked:true}]);
  assert.equal(revoked.consume(request()).ok,false);
});
