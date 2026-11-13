// CNIDARIA CNT prototype: deterministic, off-chain reward accounting. No real tokens or BSV.
export const CNT_ACTIVITIES = Object.freeze({
  toss: { reward: 2, maxPerDay: 3 },
  direct_challenge: { reward: 5, maxPerDay: 2 },
  event_attendance: { reward: 8, maxPerDay: 1 },
  lock_to_meet: { reward: 12, maxPerDay: 1 },
});
export const CNT_MAX_SUPPLY = 21_000_000;
export function createLedger() { return { version: 1, balances: {}, minted: 0, awards: [], commitments: {} }; }
function requireId(id, name) { if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('Invalid ' + name); }
export function awardCNT(ledger, { playerId, activity, proofId, day }) {
  requireId(playerId, 'playerId'); requireId(proofId, 'proofId');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) throw new Error('Invalid UTC day');
  const rule = CNT_ACTIVITIES[activity]; if (!rule) throw new Error('Unknown activity');
  const key = activity + ':' + proofId + ':' + playerId;
  if (ledger.awards.some(a => a.key === key)) return { awarded: 0, reason: 'duplicate', ledger };
  const used = ledger.awards.filter(a => a.playerId === playerId && a.activity === activity && a.day === day).length;
  if (used >= rule.maxPerDay) return { awarded: 0, reason: 'daily_cap', ledger };
  if (ledger.minted + rule.reward > CNT_MAX_SUPPLY) return { awarded: 0, reason: 'supply_cap', ledger };
  ledger.awards.push({ key, playerId, activity, proofId, day, amount: rule.reward });
  ledger.balances[playerId] = (ledger.balances[playerId] || 0) + rule.reward;
  ledger.minted += rule.reward;
  return { awarded: rule.reward, reason: 'ok', ledger };
}
export function createMeeting(ledger, { meetingId, inviter, invitee, sats, deadline }) {
  [meetingId, inviter, invitee].forEach((id, i) => requireId(id, ['meetingId','inviter','invitee'][i]));
  if (inviter === invitee) throw new Error('Two distinct participants required');
  if (!Number.isSafeInteger(sats) || sats <= 0) throw new Error('Invalid sats');
  if (!Number.isFinite(deadline) || deadline <= 0) throw new Error('Invalid deadline');
  if (ledger.commitments[meetingId]) throw new Error('Meeting already exists');
  ledger.commitments[meetingId] = { meetingId, inviter, invitee, sats, deadline, status: 'proposed', checkedIn: [], deposits: [], settlement: null };
  return ledger.commitments[meetingId];
}
export function simulateDeposit(ledger, meetingId, playerId) {
  const m = ledger.commitments[meetingId]; if (!m || ![m.inviter,m.invitee].includes(playerId)) throw new Error('Not participant');
  if (m.status === 'completed' || m.status === 'expired') throw new Error('Meeting closed');
  if (!m.deposits.includes(playerId)) m.deposits.push(playerId);
  if (m.deposits.length === 2) m.status = 'locked_simulated';
  return m;
}
export function simulateCheckIn(ledger, meetingId, playerId, now, verification = {}) {
  const m = ledger.commitments[meetingId]; if (!m || ![m.inviter,m.invitee].includes(playerId)) throw new Error('Not participant');
  if (m.status !== 'locked_simulated') throw new Error('Both simulated deposits required');
  if (!Number.isFinite(now) || now > m.deadline) throw new Error('Check-in window closed');
  if (verification.locationVerified !== true || verification.proximityVerified !== true) throw new Error('Two independent verification signals required');
  if (!m.checkedIn.includes(playerId)) m.checkedIn.push(playerId);
  if (m.checkedIn.length === 2) { m.status = 'completed'; m.settlement = { type: 'simulated_refund_both', satsEach: m.sats }; }
  return m;
}
export function expireMeeting(ledger, meetingId, now) {
  const m = ledger.commitments[meetingId]; if (!m) throw new Error('Unknown meeting');
  if (now <= m.deadline) throw new Error('Not expired');
  if (m.status === 'completed') return m;
  m.status = 'expired';
  m.settlement = { type: 'manual_review_required', note: 'No automatic forfeiture based on spoofable location evidence' };
  return m;
}
