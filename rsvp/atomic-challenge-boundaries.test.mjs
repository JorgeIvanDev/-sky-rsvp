import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ReferenceChallengeStore} from './atomic-challenge-reference.mjs';

const challenge = (id='c') => ({id, recipientId:'r', inviteId:'i', nonce:'n', expiresAt:500});
const request = (challengeId='c') => ({challengeId, recipientId:'r', inviteId:'i', nonce:'n', now:100, verified:true});

test('expiry boundary accepts the final instant but rejects the next instant', () => {
  const onBoundary = new ReferenceChallengeStore([challenge()]);
  assert.equal(onBoundary.consume({...request(), now:500}).ok, true);
  const expired = new ReferenceChallengeStore([challenge()]);
  assert.equal(expired.consume({...request(), now:501}).ok, false);
  assert.deepEqual(expired.snapshot('c'), {consumed:false, unlocked:false});
});

test('invalid timestamps and malformed expiry never spend an attempt', () => {
  for (const now of [-1, 0.5, NaN, Infinity, '100', null, undefined]) {
    const store = new ReferenceChallengeStore([challenge()]);
    assert.equal(store.consume({...request(), now}).ok, false);
    assert.deepEqual(store.snapshot('c'), {consumed:false, unlocked:false});
  }
  for (const expiresAt of [undefined, null, '500', Infinity, 0.5]) {
    const store = new ReferenceChallengeStore([{...challenge(), expiresAt}]);
    assert.equal(store.consume(request()).ok, false);
    assert.deepEqual(store.snapshot('c'), {consumed:false, unlocked:false});
  }
});

test('different challenges do not share an attempt budget', () => {
  const store = new ReferenceChallengeStore([challenge('a'), challenge('b')]);
  assert.equal(store.consume(request('a')).ok, true);
  assert.equal(store.consume(request('a')).reason, 'consumed');
  assert.equal(store.consume(request('b')).ok, true);
  assert.deepEqual(store.snapshot('b'), {consumed:true, unlocked:true});
});

test('duplicate challenge identifiers fail closed during initialization', () => {
  assert.throws(() => new ReferenceChallengeStore([challenge(), challenge()]), /Invalid challenge/);
});
