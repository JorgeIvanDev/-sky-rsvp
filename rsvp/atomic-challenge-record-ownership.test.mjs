import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ReferenceChallengeStore} from './atomic-challenge-reference.mjs';

const valid = () => ({id:'c', recipientId:'r', inviteId:'i', nonce:'n', expiresAt:500});

test('challenge records must own all security-critical fields', () => {
  for (const field of ['id', 'recipientId', 'inviteId', 'nonce', 'expiresAt']) {
    const challenge = valid();
    const inherited = {[field]:challenge[field]};
    delete challenge[field];
    Object.setPrototypeOf(challenge, inherited);
    assert.throws(() => new ReferenceChallengeStore([challenge]), /Invalid challenge/);
  }
  const store = new ReferenceChallengeStore([valid()]);
  assert.deepEqual(store.consume({challengeId:'c', recipientId:'r', inviteId:'i', nonce:'n', now:100, verified:true}), {ok:true, reason:'unlocked'});
});

test('hostile record ownership traps cannot register a challenge', () => {
  const hostile = new Proxy(valid(), {getOwnPropertyDescriptor() {throw Error('trap');}});
  assert.throws(() => new ReferenceChallengeStore([hostile]));
});
