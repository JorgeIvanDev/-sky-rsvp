// Reference-only concurrency model. NOT a production endpoint or authorization layer.
// A production adapter MUST replace this process-local store with a database transaction.
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
export class ReferenceChallengeStore {
  #records = new Map();
  constructor(challenges = []) {
    for (const challenge of challenges) {
      if (!challenge || typeof challenge !== 'object' ||
          !['id', 'recipientId', 'inviteId', 'nonce', 'expiresAt'].every(key => own(challenge, key))) throw Error('Invalid challenge');
      let id, recipientId, inviteId, nonce, expiresAt, revoked;
      try { ({id, recipientId, inviteId, nonce, expiresAt, revoked} = challenge); }
      catch { throw Error('Invalid challenge'); }
      if (![id, recipientId, inviteId, nonce].every(x => typeof x === 'string' && x.length > 0) ||
          !Number.isSafeInteger(expiresAt) || expiresAt < 0 || this.#records.has(id)) throw Error('Invalid challenge');
      this.#records.set(id, {
        recipientId, inviteId, nonce, expiresAt,
        revoked: revoked === true, consumed: false, unlocked: false
      });
    }
  }
  // Single-process reference only; untrusted objects must fail closed.
  consume(request) {
    try {
      if (!request || typeof request !== 'object') return {ok:false, reason:'invalid'};
      const fields = ['challengeId', 'recipientId', 'inviteId', 'nonce', 'now', 'verified'];
      if (!fields.every(field => own(request, field))) return {ok:false, reason:'invalid'};
      const {challengeId, recipientId, inviteId, nonce, now, verified} = request;
      if (![challengeId, recipientId, inviteId, nonce].every(x => typeof x === 'string' && x.length > 0) ||
          !Number.isSafeInteger(now) || now < 0 || typeof verified !== 'boolean') return {ok:false, reason:'invalid'};
      const row = this.#records.get(challengeId);
      if (!row || row.recipientId !== recipientId || row.inviteId !== inviteId ||
          row.nonce !== nonce || row.revoked === true ||
          !Number.isSafeInteger(row.expiresAt) || now > row.expiresAt) return {ok:false, reason:'invalid'};
      if (row.consumed) return {ok:false, reason:'consumed'};
      row.consumed = true;
      row.unlocked = verified === true;
      return {ok:row.unlocked, reason:row.unlocked ? 'unlocked' : 'failed'};
    } catch {
      return {ok:false, reason:'invalid'};
    }
  }
  snapshot(id) {
    const row = this.#records.get(id);
    return row ? Object.freeze({consumed:row.consumed, unlocked:row.unlocked}) : null;
  }
}
