// Fail-closed authorization preflight for a future trusted host inbox service.
// All records MUST originate from authenticated server-side lookups, never request JSON.
// This does not grant database access, replace RLS, or provide an HTTP endpoint.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function record(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).length !== fields.length) return null;
    const output = Object.create(null);
    for (const field of fields) {
      const d = Object.getOwnPropertyDescriptor(descriptors, field);
      if (!d || !Object.hasOwn(d.value, 'value')) return null;
      output[field] = d.value.value;
    }
    return output;
  } catch { return null; }
}
export function authorizeHostInboxPreflight(envelope) {
  const e = record(envelope, ['principal', 'invite', 'query']);
  if (!e) return false;
  const p = record(e.principal, ['userId']);
  const i = record(e.invite, ['id', 'ownerUserId', 'deletedAt']);
  const q = record(e.query, ['inviteId', 'limit']);
  if (!p || !i || !q) return false;
  if (![p.userId, i.id, i.ownerUserId, q.inviteId].every(v => typeof v === 'string' && uuid.test(v))) return false;
  if (p.userId !== i.ownerUserId || i.id !== q.inviteId || i.deletedAt !== null) return false;
  if (!Number.isSafeInteger(q.limit) || q.limit < 1 || q.limit > 50) return false;
  return true;
}
