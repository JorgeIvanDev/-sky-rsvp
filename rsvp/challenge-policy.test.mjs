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

test('one attempt is the maximum per challenge',()=>{
 assert.equal(MAX_ATTEMPTS,1);
 assert.equal(validateChallengeRecord({...record,attempts:1},request),'rate_limited');
 assert.equal(validateChallengeRecord({...record,attempts:0},request),null);
});

test('fail closed for malformed or non-finite attempt counters',()=>{
 for(const attempts of [null,undefined,'0',NaN,Infinity,-Infinity,0.5,Number.MAX_SAFE_INTEGER+1]){
  assert.equal(validateChallengeRecord({...record,attempts},request),'rate_limited');
 }
});
test('fail closed for malformed issuance timestamps',()=>{
 for(const issuedAt of [null,undefined,'yesterday',NaN,Infinity,now+0.5,Number.MAX_SAFE_INTEGER+1]){
  assert.equal(validateChallengeRecord({...record,issuedAt},request),'expired');
 }
});
test('only literal boolean true counts as verified evidence',()=>{
 for(const evidenceVerified of [undefined,null,1,'true',{},false]){
  assert.deepEqual(evaluateParticipation(record,{...request,evidenceVerified}),{ok:false,reason:'unverified_evidence'});
 }
});
test('replay is denied even when evidence is marked verified',()=>{
 assert.deepEqual(evaluateParticipation({...record,consumedAt:now-1},request),{ok:false,reason:'replayed'});
});

test('consumption marker must be explicitly null to be unused',()=>{
 for(const consumedAt of [undefined,false,0,'',{},NaN]){
  assert.equal(validateChallengeRecord({...record,consumedAt},request),'replayed');
 }
 const {consumedAt,...withoutMarker}=record;
 assert.equal(validateChallengeRecord(withoutMarker,request),'replayed');
 assert.equal(validateChallengeRecord({...record,consumedAt:null},request),null);
});

test('inherited consumption marker cannot masquerade as an unused own field',()=>{
 const inherited=Object.create({consumedAt:null});
 Object.assign(inherited,{recipientId:record.recipientId,inviteId:record.inviteId,nonce:record.nonce,issuedAt:record.issuedAt,attempts:0});
 assert.equal(validateChallengeRecord(inherited,request),'replayed');
 assert.deepEqual(evaluateParticipation(inherited,request),{ok:false,reason:'replayed'});
});

test('evidence does not override missing or exhausted challenge state',()=>{
 const cases=[
  [{...record,attempts:1},'rate_limited'],
  [{...record,consumedAt:now},'replayed'],
  [{...record,issuedAt:now-CHALLENGE_TTL_MS-1},'expired'],
 ];
 for(const [candidate,reason] of cases){
  assert.deepEqual(evaluateParticipation(candidate,{...request,evidenceVerified:true}),{ok:false,reason});
 }
});

test('inherited identity, issuance, and attempt fields cannot validate a challenge',()=>{
 for(const [field,reason] of [['recipientId','mismatch'],['inviteId','mismatch'],['nonce','mismatch'],['issuedAt','expired'],['attempts','rate_limited']]){
  const own={...record};
  delete own[field];
  const candidate=Object.assign(Object.create({[field]:record[field]}),own);
  assert.equal(validateChallengeRecord(candidate,request),reason);
  assert.deepEqual(evaluateParticipation(candidate,request),{ok:false,reason});
 }
});

test('inherited evidence flag cannot authorize participation',()=>{
 const inherited=Object.assign(Object.create({evidenceVerified:true}),{now,recipientId:request.recipientId,inviteId:request.inviteId,nonce:request.nonce});
 assert.deepEqual(evaluateParticipation(record,inherited),{ok:false,reason:'unverified_evidence'});
});

test('inherited request identity and clock fields cannot validate participation',()=>{
 for(const field of ['now','recipientId','inviteId','nonce']){
  const own={...request};
  delete own[field];
  const inherited=Object.assign(Object.create({[field]:request[field]}),own);
  assert.equal(validateChallengeRecord(record,inherited),'invalid_request');
  assert.deepEqual(evaluateParticipation(record,inherited),{ok:false,reason:'invalid_request'});
 }
});
