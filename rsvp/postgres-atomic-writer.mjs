// Server-only PostgreSQL adapter. Inject a dedicated, non-web database connection
// with EXECUTE on cnidaria_internal.submit_beta_rsvp; never expose via PostgREST.
// The SQL function performs authorization and challenge consumption atomically.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX = /^[a-f0-9]{64}$/;
export function createAtomicRsvpWriter(db) {
  if (!db || typeof db.query !== 'function') throw new TypeError('Private database required');
  return async function submitAtomic(input) {
    if (!input || typeof input !== 'object' ||
        ![input.userId, input.inviteId, input.recipientId, input.challengeId].every(v => typeof v === 'string' && UUID.test(v)) ||
        typeof input.idempotencyKey !== 'string' || !HEX.test(input.idempotencyKey) ||
        !['yes', 'maybe', 'no'].includes(input.choice)) throw new Error('RSVP unavailable');
    // Explicit parameters: never interpolate client data or use public.rpc().
    const result = await db.query({
      text: 'select receipt_id, saved_choice, saved_at from cnidaria_internal.submit_beta_rsvp($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::text)',
      values: [input.userId, input.inviteId, input.recipientId, input.challengeId, input.idempotencyKey, input.choice]
    });
    if (!result || !Array.isArray(result.rows) || result.rows.length !== 1) throw new Error('RSVP unavailable');
    const row = result.rows[0];
    const receiptId = row?.receipt_id;
    const choice = row?.saved_choice;
    const savedAt = row?.saved_at instanceof Date ? row.saved_at.toISOString() : row?.saved_at;
    if (typeof receiptId !== 'string' || !UUID.test(receiptId) || choice !== input.choice ||
        typeof savedAt !== 'string' || !Number.isFinite(Date.parse(savedAt))) throw new Error('RSVP unavailable');
    return { receiptId, choice, savedAt };
  };
}
