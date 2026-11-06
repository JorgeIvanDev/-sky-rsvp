import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRsvpSubmission} from './rsvp-submit-policy.mjs';
const valid = () => ({
 inviteId:'123e4567-e89b-42d3-a456-426614174000',
 recipientId:'123e4567-e89b-42d3-a456-426614174001',
 challengeId:'123e4567-e89b-42d3-a456-426614174002',
 idempotencyKey:'a'.repeat(64),
 choice:'yes'
});
test('valid direct RSVP payload is frozen and normalized to allowed fields',()=>{
 const output=validateRsvpSubmission(valid());
 assert.deepEqual(output,valid());
 assert.ok(Object.isFrozen(output));
});
test('only the three RSVP choices are allowed',()=>{
 for(const choice of ['YES','pending','',null,0,'yes\n']) {
  assert.throws(()=>validateRsvpSubmission({...valid(),choice}),/Invalid RSVP submission/);
 }
});
test('recipient, invite, challenge and idempotency keys are mandatory',()=>{
 for(const key of Object.keys(valid())){
  const input=valid(); delete input[key];
  assert.throws(()=>validateRsvpSubmission(input),/Invalid RSVP submission/);
 }
});
test('rejects extra fields, inherited fields, accessors and arrays',()=>{
 assert.throws(()=>validateRsvpSubmission({...valid(),admin:true}),/Invalid RSVP submission/);
 assert.throws(()=>validateRsvpSubmission(Object.assign(Object.create({admin:true}),valid())),/Invalid RSVP submission/);
 const input=valid(); Object.defineProperty(input,'choice',{get(){throw Error('secret');}});
 assert.throws(()=>validateRsvpSubmission(input),/Invalid RSVP submission/);
 assert.throws(()=>validateRsvpSubmission([]),/Invalid RSVP submission/);
});
test('hostile proxies fail closed with controlled errors',()=>{
 for(const trap of ['getPrototypeOf','ownKeys','getOwnPropertyDescriptor']){
  const proxy=new Proxy(valid(),{[trap](){throw Error('private exception');}});
  assert.throws(()=>validateRsvpSubmission(proxy),e=>e.message==='Invalid RSVP submission');
 }
});
test('rejects malformed identifiers and unsafe idempotency keys',()=>{
 for(const key of ['inviteId','recipientId','challengeId','idempotencyKey']){
  const input=valid(); input[key]='../../attack';
  assert.throws(()=>validateRsvpSubmission(input),/Invalid RSVP submission/);
 }
});
