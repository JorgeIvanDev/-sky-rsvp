import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ReferenceChallengeStore} from './atomic-challenge-reference.mjs';

const base = {id:'c',recipientId:'r',inviteId:'i',nonce:'n',expiresAt:500};
const request = {challengeId:'c',recipientId:'r',inviteId:'i',nonce:'n',now:100,verified:true};

test('challenge identity is read once and stored under its validated key', () => {
  let reads = 0;
  const challenge = {...base};
  Object.defineProperty(challenge,'id',{enumerable:true,get(){reads++;return reads === 1 ? 'c' : 'other';}});
  const store = new ReferenceChallengeStore([challenge]);
  assert.equal(reads,1);
  assert.equal(store.consume(request).ok,true);
  assert.equal(store.snapshot('other'),null);
});

test('revocation is snapshotted once and cannot change after insertion', () => {
  let reads = 0;
  const challenge = {...base};
  Object.defineProperty(challenge,'revoked',{get(){reads++;return true;}});
  const store = new ReferenceChallengeStore([challenge]);
  assert.equal(reads,1);
  assert.equal(store.consume(request).ok,false);
});

test('throwing accessors cannot initialize a challenge', () => {
  const challenge = {...base};
  Object.defineProperty(challenge,'nonce',{get(){throw Error('hostile');}});
  assert.throws(()=>new ReferenceChallengeStore([challenge]),/Invalid challenge/);
});
