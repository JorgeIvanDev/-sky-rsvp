import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorizeRsvpPreflight} from './recipient-authorization.mjs';
const ids = Array.from({length:5}, (_,i)=>`123e4567-e89b-42d3-a456-42661417400${i}`);
const valid = () => ({
 principal:{userId:ids[0]},
 recipient:{id:ids[1],inviteId:ids[2],userId:ids[0],revoked:false},
 challenge:{id:ids[3],inviteId:ids[2],recipientId:ids[1],issuedAt:1000,expiresAt:301000,verifiedAt:2000,consumedAt:null,revokedAt:null},
 submission:{inviteId:ids[2],recipientId:ids[1],challengeId:ids[3],idempotencyKey:'a'.repeat(64),choice:'yes'},now:3000
});
test('valid trusted record linkage passes preflight only',()=>assert.equal(authorizeRsvpPreflight(valid()),true));
test('cross-recipient, cross-invite, and unauthenticated attempts fail closed',()=>{
 for(const [section,key,value] of [['principal','userId',ids[4]],['recipient','userId',ids[4]],['recipient','id',ids[4]],['recipient','inviteId',ids[4]],['challenge','recipientId',ids[4]],['challenge','inviteId',ids[4]],['submission','recipientId',ids[4]],['submission','inviteId',ids[4]],['submission','challengeId',ids[4]]]){
  const v=valid();v[section][key]=value;assert.equal(authorizeRsvpPreflight(v),false,`${section}.${key}`);
 }
 assert.equal(authorizeRsvpPreflight({...valid(),principal:null}),false);
});
test('expired, unverified, consumed, revoked and future-verified challenges denied',()=>{
 for(const [section,key,value] of [['recipient','revoked',true],['challenge','verifiedAt',null],['challenge','verifiedAt',4000],['challenge','verifiedAt',999],['challenge','expiresAt',3000],['challenge','consumedAt',2500],['challenge','revokedAt',2500],['challenge','expiresAt',301001]]){
  const v=valid();v[section][key]=value;assert.equal(authorizeRsvpPreflight(v),false,`${section}.${key}`);
 }
});
test('hostile objects, extra authority claims and malformed time fail closed',()=>{
 for(const section of ['principal','recipient','challenge','submission']){
  const v=valid();v[section].admin=true;assert.equal(authorizeRsvpPreflight(v),false);
  const w=valid();w[section]=new Proxy(w[section],{ownKeys(){throw Error('secret');}});assert.equal(authorizeRsvpPreflight(w),false);
 }
 assert.equal(authorizeRsvpPreflight({...valid(),now:NaN}),false);
 assert.equal(authorizeRsvpPreflight({...valid(),now:Infinity}),false);
});

test('hostile top-level envelopes fail closed without throwing',()=>{
 assert.equal(authorizeRsvpPreflight(undefined),false);
 assert.equal(authorizeRsvpPreflight(null),false);
 assert.equal(authorizeRsvpPreflight({ ...valid(), admin:true }),false);
 assert.equal(authorizeRsvpPreflight(Object.create({ ...valid() })),false);
 assert.equal(authorizeRsvpPreflight({ ...valid(), get principal(){ throw Error('getter'); } }),false);
 assert.equal(authorizeRsvpPreflight(new Proxy(valid(), {ownKeys(){ throw Error('proxy'); }})),false);
});
