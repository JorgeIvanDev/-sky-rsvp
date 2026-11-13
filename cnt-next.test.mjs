import test from 'node:test';
import assert from 'node:assert/strict';
import {createLedger,awardFromDemoProof,validateActivityProof,validateLedger,createMeeting,simulateDeposit,cancelMeeting,expireMeeting} from './cnt-core.mjs';
const proof=(id='p1')=>({playerId:'alice',activity:'toss',proofId:id,day:'2026-11-13',evidence:{kind:'demo_attestation',verified:true}});
test('demo proof validates and replay does not mint twice',()=>{const l=createLedger();assert.equal(awardFromDemoProof(l,proof()).awarded,2);assert.equal(awardFromDemoProof(l,proof()).reason,'duplicate');assert.equal(validateLedger(JSON.parse(JSON.stringify(l))).balances.alice,2)});
test('unverified or invalid activity proofs are rejected',()=>{const l=createLedger();assert.throws(()=>awardFromDemoProof(l,{...proof(),evidence:{verified:false}}));assert.throws(()=>validateActivityProof({...proof(),day:'2026-02-30'}));assert.equal(l.minted,0)});
test('tampered snapshot fails validation',()=>{const l=createLedger();awardFromDemoProof(l,proof());const saved=JSON.parse(JSON.stringify(l));saved.balances.alice=999;assert.throws(()=>validateLedger(saved))});
test('cancelled meeting refunds only simulated depositors',()=>{const l=createLedger();createMeeting(l,{meetingId:'m',inviter:'alice',invitee:'bob',sats:10000,deadline:200});simulateDeposit(l,'m','alice');const m=cancelMeeting(l,'m','alice');assert.equal(m.status,'cancelled');assert.deepEqual(m.settlement.players,['alice']);assert.throws(()=>simulateDeposit(l,'m','bob'))});
test('expired meeting does not confiscate funds',()=>{const l=createLedger();createMeeting(l,{meetingId:'m',inviter:'alice',invitee:'bob',sats:10000,deadline:200});assert.equal(expireMeeting(l,'m',201).settlement.type,'manual_review_required')});
