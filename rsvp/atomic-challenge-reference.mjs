// Reference-only concurrency model. NOT a production endpoint or authorization layer.
// A production adapter MUST replace this process-local store with a database transaction.
export class ReferenceChallengeStore {
  #records = new Map();
  constructor(challenges = []) {
    for (const challenge of challenges) {
      if (!challenge || typeof challenge.id !== 'string' || this.#records.has(challenge.id)) throw Error('Invalid challenge');
      this.#records.set(challenge.id, { ...challenge, consumed: false, unlocked: false });
    }
  }
  // No await inside the critical section: JavaScript executes this transition synchronously.
  // This guarantee applies ONLY within one process, not across servers or restarts.
  consume({challengeId, recipientId, inviteId, nonce, now, verified}) {
    if (![challengeId, recipientId, inviteId, nonce].every(x => typeof x === 'string' && x.length > 0) ||
        !Number.isSafeInteger(now) || now < 0 || typeof verified !== 'boolean') return {ok:false, reason:'invalid'};
    const row = this.#records.get(challengeId);
    if (!row || row.recipientId !== recipientId || row.inviteId !== inviteId ||
        row.nonce !== nonce || row.revoked === true ||
        !Number.isSafeInteger(row.expiresAt) || now > row.expiresAt) return {ok:false, reason:'invalid'};
    if (row.consumed) return {ok:false, reason:'consumed'};
    row.consumed = true; // A valid submitted failure also spends the single attempt.
    row.unlocked = verified === true;
    return {ok:row.unlocked, reason:row.unlocked ? 'unlocked' : 'failed'};
  }
  snapshot(id) {
    const row = this.#records.get(id);
    return row ? Object.freeze({consumed:row.consumed, unlocked:row.unlocked}) : null;
  }
}
