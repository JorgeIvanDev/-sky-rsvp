import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ReferenceChallengeStore} from './atomic-challenge-reference.mjs';

const valid = () => ({id:'c', recipientId:'r', inviteId:'i', nonce:'n', expiresAt:500});
const request = () => ({challengeId:'c', recipientId:'r', inviteId:'i', nonce:'n', now:100, verified:true});

test('rejects incomplete challenge records before storing them', () => {
  for (const field of ['id','recipientId','inviteId','nonce']) {
    for (const value of ['', null, undefined, 12]) {
      assert.throws(() => new ReferenceChallengeStore([{...valid(), [field]:value}]), /Invalid challenge/);
    }
  }
  for (const expiresAt of [-1, null, undefined, '500', Infinity, 0.5]) {
    assert.throws(() => new ReferenceChallengeStore([{...valid(), expiresAt}]), /Invalid challenge/);
  }
});

test('caller mutation cannot change challenge identity or expiry after initialization', () => {
  const challenge = valid();
  const store = new ReferenceChallengeStore([challenge]);
  Object.assign(challenge, {recipientId:'attacker', inviteId:'other', nonce:'other', expiresAt:0, revoked:true});
  assert.deepEqual(store.consume(request()), {ok:true, reason:'unlocked'});
});

test('revoked records remain closed even when caller changes their object', () => {
  const challenge = {...valid(), revoked:true};
  const store = new ReferenceChallengeStore([challenge]);
  challenge.revoked = false;
  assert.deepEqual(store.consume(request()), {ok:false, reason:'invalid'});
  assert.deepEqual(store.snapshot('c'), {consumed:false, unlocked:false});
});
