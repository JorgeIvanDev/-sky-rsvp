import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateParticipation,validateChallengeRecord,CHALLENGE_TTL_MS,MAX_ATTEMPTS} from './challenge-policy.mjs';
const now=1_800_000_000_000;
const request={now,recipientId:'recipient-A',inviteId:'invite-A',nonce:'random-nonce',evidenceVerified:true};
const record={recipientId:request.recipientId,inviteId:request.inviteId,nonce:request.nonce,issuedAt:now-1000,consumedAt:null,attempts:0};
test('verified, unconsumed, unexpired attempt passes policy only',()=>assert.deepEqual(evaluateParticipation(record,request),{ok:true}));
for(const [name,patch,reason] of [
 ['missing record',null,'missing'],
 ['wrong recipient',{recipientId:'recipient-B'},'mismatch'],
 ['wrong invitation',{inviteId:'invite-B'},'mismatch'],
 ['wrong nonce',{nonce:'other'},'mismatch'],
 ['expired',{issuedAt:now-CHALLENGE_TTL_MS-1},'expired'],
 ['future issued',{issuedAt:now+1},'expired'],
 ['already consumed',{consumedAt:now-1},'replayed'],
 ['attempt limit',{attempts:MAX_ATTEMPTS},'rate_limited'],
 ['invalid attempt count',{attempts:-1},'rate_limited']
]) test('reject '+name,()=>assert.equal(validateChallengeRecord(patch===null?null:{...record,...patch},request),reason));
test('reject unverified evidence',()=>assert.equal(evaluateParticipation(record,{...request,evidenceVerified:false}).reason,'unverified_evidence'));
test('reject missing identity',()=>assert.equal(evaluateParticipation(record,{...request,recipientId:''}).reason,'invalid_request'));
test('expiry boundary accepted',()=>assert.equal(validateChallengeRecord({...record,issuedAt:now-CHALLENGE_TTL_MS},request),null));

test('reject null request without throwing',()=>assert.equal(validateChallengeRecord(record,null),'invalid_request'));
test('reject undefined request without throwing',()=>assert.equal(evaluateParticipation(record,undefined).reason,'invalid_request'));
test('reject numeric recipient identity',()=>assert.equal(validateChallengeRecord(record,{...request,recipientId:123}),'invalid_request'));
test('reject object invitation identity',()=>assert.equal(validateChallengeRecord(record,{...request,inviteId:{}}),'invalid_request'));
test('reject non-string nonce',()=>assert.equal(validateChallengeRecord(record,{...request,nonce:42}),'invalid_request'));

test('reject fractional current timestamp',()=>assert.equal(validateChallengeRecord(record,{...request,now:now+0.5}),'invalid_time'));
test('reject negative current timestamp',()=>assert.equal(validateChallengeRecord(record,{...request,now:-1}),'invalid_time'));
test('reject unsafe integer current timestamp',()=>assert.equal(validateChallengeRecord(record,{...request,now:Number.MAX_SAFE_INTEGER+1}),'invalid_time'));
test('reject negative issuance timestamp',()=>assert.equal(validateChallengeRecord({...record,issuedAt:-1},request),'expired'));
test('reject oversized nonce',()=>assert.equal(validateChallengeRecord(record,{...request,nonce:'x'.repeat(257)}),'invalid_request'));
test('reject oversized recipient',()=>assert.equal(validateChallengeRecord(record,{...request,recipientId:'x'.repeat(257)}),'invalid_request'));
test('reject whitespace-padded invitation identity',()=>assert.equal(validateChallengeRecord(record,{...request,inviteId:' invite-A '}),'invalid_request'));

test('reject embedded newline in nonce',()=>assert.equal(validateChallengeRecord(record,{...request,nonce:'random'+String.fromCharCode(10)+'nonce'}),'invalid_request'));
test('reject embedded NUL in recipient',()=>assert.equal(validateChallengeRecord(record,{...request,recipientId:'recipient'+String.fromCharCode(0)+'A'}),'invalid_request'));
test('reject DEL control in invitation',()=>assert.equal(validateChallengeRecord(record,{...request,inviteId:'invite'+String.fromCharCode(127)+'A'}),'invalid_request'));
test('reject whitespace-only identity',()=>assert.equal(validateChallengeRecord(record,{...request,nonce:'   '}),'invalid_request'));
