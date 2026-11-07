// Trusted-server adapter for the private host inbox SQL function.
// Never expose this connection or cnidaria_internal through a browser or PostgREST.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createPostgresHostInboxReader(db) {
  if (!db || typeof db.query !== 'function') throw new TypeError('Private database required');
  return async function readResponses({ hostUserId, inviteId, limit } = {}) {
    if (typeof hostUserId !== 'string' || !UUID.test(hostUserId) ||
        typeof inviteId !== 'string' || !UUID.test(inviteId) ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 50)
      throw new Error('Inbox unavailable');
    // Ownership is checked again inside the database function; the caller's
    // preflight check is not sufficient to authorize a private read.
    const result = await db.query({
      text: 'select receipt_id, choice, saved_at from cnidaria_internal.read_beta_host_inbox($1::uuid,$2::uuid,$3::integer)',
      values: [hostUserId, inviteId, limit]
    });
    if (!result || !Array.isArray(result.rows) || result.rows.length > limit)
      throw new Error('Inbox unavailable');
    return result.rows.map(row => {
      const receiptId = row?.receipt_id;
      const choice = row?.choice;
      const savedAt = row?.saved_at instanceof Date ? row.saved_at.toISOString() : row?.saved_at;
      if (typeof receiptId !== 'string' || !UUID.test(receiptId) ||
          !['yes', 'maybe', 'no'].includes(choice) ||
          typeof savedAt !== 'string' || !Number.isFinite(Date.parse(savedAt)))
        throw new Error('Inbox unavailable');
      return { receiptId, choice, savedAt };
    });
  };
}
