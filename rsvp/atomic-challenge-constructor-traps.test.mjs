import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ReferenceChallengeStore} from './atomic-challenge-reference.mjs';

const valid = {id:'c',recipientId:'r',inviteId:'i',nonce:'n',expiresAt:500};
const request = {challengeId:'c',recipientId:'r',inviteId:'i',nonce:'n',now:100,verified:true};

test('hostile own-property proxy trap produces a bounded invalid-challenge error', () => {
  const hostile = new Proxy({...valid}, {
    getOwnPropertyDescriptor() { throw new Error('sensitive proxy exception'); }
  });
  assert.throws(() => new ReferenceChallengeStore([hostile]), error =>
    error instanceof Error && error.message === 'Invalid challenge');
});

test('hostile revoked accessor is normalized without leaking its exception', () => {
  const hostile = {...valid};
  Object.defineProperty(hostile, 'revoked', {get() {throw Error('sensitive accessor exception');}});
  assert.throws(() => new ReferenceChallengeStore([hostile]), error =>
    error instanceof Error && error.message === 'Invalid challenge');
});

test('valid challenge remains consumable after constructor hardening', () => {
  const store = new ReferenceChallengeStore([valid]);
  assert.deepEqual(store.consume(request), {ok:true,reason:'unlocked'});
  assert.deepEqual(store.consume(request), {ok:false,reason:'consumed'});
});
