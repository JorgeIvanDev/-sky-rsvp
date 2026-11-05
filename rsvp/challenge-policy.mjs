// Prototype only. No public endpoint or database grants are provided.
// The caller must authenticate the recipient, enforce distributed rate limits,
// and atomically consume the challenge in a trusted transactional store.
export const CHALLENGE_TTL_MS = 5 * 60_000;
// A challenge allows one genuine attempt; accessibility alternatives are separate modes.
// The trusted server must count attempts atomically before evaluating evidence.
export const MAX_ATTEMPTS = 1;

export function validateChallengeRecord(record, request) {
  if (!request || typeof request !== 'object') return 'invalid_request';
  // Never accept identity or clock values inherited through a prototype chain.
  if (!['now', 'recipientId', 'inviteId', 'nonce'].every(key => Object.hasOwn(request, key))) return 'invalid_request';
  // A malicious accessor must not crash the verifier or bypass fail-closed checks.
  let now, recipientId, inviteId, nonce;
  try { ({now, recipientId, inviteId, nonce} = request); } catch { return 'invalid_request'; }
  if (!record || typeof record !== 'object') return 'missing';
  if (!Number.isSafeInteger(now) || now < 0) return 'invalid_time';
  if (![recipientId, inviteId, nonce].every(value => typeof value === 'string' && value.length > 0 && value.length <= 256 && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value) && value.trim().length > 0)) return 'invalid_request';
  if (![ 'recipientId', 'inviteId', 'nonce' ].every(key => Object.hasOwn(record, key))) return 'mismatch';
  try {
    if (record.recipientId !== recipientId || record.inviteId !== inviteId || record.nonce !== nonce) return 'mismatch';
    if (!Object.hasOwn(record, 'issuedAt') || !Number.isSafeInteger(record.issuedAt) || record.issuedAt < 0 || record.issuedAt > now || now - record.issuedAt > CHALLENGE_TTL_MS) return 'expired';
    if (!Object.hasOwn(record, 'consumedAt') || record.consumedAt !== null) return 'replayed';
    if (!Object.hasOwn(record, 'attempts') || !Number.isSafeInteger(record.attempts) || record.attempts < 0 || record.attempts >= MAX_ATTEMPTS) return 'rate_limited';
  } catch { return 'invalid_record'; }
  return null;
}

// This is a policy check, NOT proof of motion or genuine human participation.
// A production verifier must require trusted evidence, and perform the check
// and single-use state transition atomically inside the server-side transaction.
export function evaluateParticipation(record, request) {
  const error = validateChallengeRecord(record, request);
  if (error) return {ok:false, reason:error};
  try {
    if (!Object.hasOwn(request, 'evidenceVerified') || request.evidenceVerified !== true) return {ok:false, reason:'unverified_evidence'};
  } catch { return {ok:false, reason:'unverified_evidence'}; }
  return {ok:true};
}

