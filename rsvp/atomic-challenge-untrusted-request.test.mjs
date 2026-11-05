import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ReferenceChallengeStore} from './atomic-challenge-reference.mjs';
const valid = () => ({id:'c', recipientId:'r', inviteId:'i', nonce:'n', expiresAt:500});
const request = () => ({challengeId:'c', recipientId:'r', inviteId:'i', nonce:'n', now:100, verified:true});
test('null and malformed request objects fail closed without spending the attempt', () => {
  const store = new ReferenceChallengeStore([valid()]);
  for (const value of [null, undefined, 12, 'abc', Object.create(null)]) {
    assert.deepEqual(store.consume(value), {ok:false, reason:'invalid'});
  }
  assert.deepEqual(store.consume(request()), {ok:true, reason:'unlocked'});
});
test('inherited request fields cannot authorize a challenge', () => {
  const store = new ReferenceChallengeStore([valid()]);
  const inherited = Object.create(request());
  assert.deepEqual(store.consume(inherited), {ok:false, reason:'invalid'});
  assert.deepEqual(store.consume(request()), {ok:true, reason:'unlocked'});
});
test('throwing accessors and proxy ownership traps fail closed', () => {
  const store = new ReferenceChallengeStore([valid()]);
  const getter = request();
  Object.defineProperty(getter, 'verified', {get() {throw Error('trap');}});
  assert.deepEqual(store.consume(getter), {ok:false, reason:'invalid'});
  assert.deepEqual(store.consume(new Proxy(request(), {getOwnPropertyDescriptor() {throw Error('trap');}})), {ok:false, reason:'invalid'});
  assert.deepEqual(store.consume(request()), {ok:true, reason:'unlocked'});
});
