// Pure fail-closed authorization preflight for a future trusted RSVP service.
// Inputs MUST come from authenticated server/database lookups, not browser claims.
// Not a replacement for SQL transactions, rate limiting, RLS, or evidence verification.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const own = (x, k) => Object.prototype.hasOwnProperty.call(x, k);
const read = (obj, keys) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  try {
    if (Object.getPrototypeOf(obj) !== Object.prototype && Object.getPrototypeOf(obj) !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(obj);
    if (Reflect.ownKeys(descriptors).length !== keys.length) return null;
    const out = Object.create(null);
    for (const key of keys) {
      if (!own(descriptors, key) || !own(descriptors[key], 'value')) return null;
      out[key] = descriptors[key].value;
    }
    return out;
  } catch { return null; }
};
export function authorizeRsvpPreflight(input) {
  // Never destructure an untrusted envelope: getters and Proxy traps may throw.
  const envelope = read(input, ['principal', 'recipient', 'challenge', 'submission', 'now']);
  if (!envelope) return false;
  const {principal, recipient, challenge, submission, now} = envelope;
  const p = read(principal, ['userId']);
  const r = read(recipient, ['id', 'inviteId', 'userId', 'revoked']);
  const c = read(challenge, ['id', 'inviteId', 'recipientId', 'issuedAt', 'expiresAt', 'verifiedAt', 'consumedAt', 'revokedAt']);
  const s = read(submission, ['inviteId', 'recipientId', 'challengeId', 'idempotencyKey', 'choice']);
  if (!p || !r || !c || !s || !Number.isSafeInteger(now) || now < 0) return false;
  if (![p.userId,r.id,r.inviteId,r.userId,c.id,c.inviteId,c.recipientId,s.inviteId,s.recipientId,s.challengeId].every(x => typeof x === 'string' && uuid.test(x))) return false;
  if (p.userId !== r.userId || r.revoked !== false || r.id !== s.recipientId || r.inviteId !== s.inviteId || c.id !== s.challengeId || c.inviteId !== r.inviteId || c.recipientId !== r.id) return false;
  if (!Number.isSafeInteger(c.issuedAt) || !Number.isSafeInteger(c.expiresAt) || !Number.isSafeInteger(c.verifiedAt)) return false;
  if (c.issuedAt > c.verifiedAt || c.verifiedAt > now || now >= c.expiresAt || c.expiresAt <= c.issuedAt || c.expiresAt - c.issuedAt > 300000) return false;
  if (c.consumedAt !== null || c.revokedAt !== null) return false;
  if (typeof s.idempotencyKey !== 'string' || !/^[a-f0-9]{64}$/.test(s.idempotencyKey) || !['yes','maybe','no'].includes(s.choice)) return false;
  return true;
}
