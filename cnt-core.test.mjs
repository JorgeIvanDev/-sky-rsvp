import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedger, awardCNT, createMeeting, simulateDeposit, simulateCheckIn, expireMeeting, CNT_MAX_SUPPLY } from './cnt-core.mjs';
const award = (l, activity, proofId, day='2026-11-13') => awardCNT(l, {playerId:'alice',activity,proofId,day});
test('all four activities mint to one shared CNT balance', () => {
 const l=createLedger(); for(const [a,i] of ['toss','direct_challenge','event_attendance','lock_to_meet'].entries()) assert.ok(award(l,a,'p'+i).awarded>0);
 assert.equal(l.balances.alice,27); assert.equal(l.minted,27);
});
test('idempotency prevents replay minting',()=>{const l=createLedger();award(l,'toss','proof');assert.equal(award(l,'toss','proof').reason,'duplicate');assert.equal(l.minted,2)});
test('daily caps stop farming',()=>{const l=createLedger();for(let i=0;i<3;i++)award(l,'toss','p'+i);assert.equal(award(l,'toss','extra').reason,'daily_cap')});
test('finite supply cannot overflow',()=>{const l=createLedger();l.minted=CNT_MAX_SUPPLY-1;assert.equal(award(l,'toss','p').reason,'supply_cap')});
test('meeting requires both deposits and two check-in signals',()=>{
 const l=createLedger();createMeeting(l,{meetingId:'m1',inviter:'alice',invitee:'bob',sats:10000,deadline:200});
 simulateDeposit(l,'m1','alice');assert.throws(()=>simulateCheckIn(l,'m1','alice',100,{locationVerified:true,proximityVerified:true}));
 simulateDeposit(l,'m1','bob');assert.throws(()=>simulateCheckIn(l,'m1','alice',100,{locationVerified:true}));
 simulateCheckIn(l,'m1','alice',100,{locationVerified:true,proximityVerified:true});
 const m=simulateCheckIn(l,'m1','bob',101,{locationVerified:true,proximityVerified:true});
 assert.equal(m.status,'completed');assert.equal(m.settlement.satsEach,10000);
});
test('expired commitment requires review, never automatic forfeiture',()=>{
 const l=createLedger();createMeeting(l,{meetingId:'m2',inviter:'alice',invitee:'bob',sats:10000,deadline:200});
 const m=expireMeeting(l,'m2',201);assert.equal(m.settlement.type,'manual_review_required');
});
test('reject invalid inputs and self-meeting',()=>{
 const l=createLedger();assert.throws(()=>award(l,'toss','x','bad'));
 assert.throws(()=>createMeeting(l,{meetingId:'m',inviter:'alice',invitee:'alice',sats:100,deadline:100}));
});
