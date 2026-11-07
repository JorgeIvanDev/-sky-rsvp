// Trusted-server host inbox boundary. Never call this from browser code or expose privileged DB keys.
import { authorizeHostInboxPreflight } from './host-inbox-authorization.mjs';

export function createPrivateHostInboxHandler({ authenticate, rateLimit, loadInvite, readResponses }) {
  if ([authenticate, rateLimit, loadInvite, readResponses].some(fn => typeof fn !== 'function'))
    throw new TypeError('Trusted host inbox dependencies required');
  const denied = Object.freeze({ status: 403, body: { error: 'Inbox unavailable' } });
  return async function getHostInbox(request) {
    try {
      if (!request || request.method !== 'GET') return denied;
      const principal = await authenticate(request);
      if (!principal || typeof principal.userId !== 'string' || !principal.userId.trim()) return denied;
      if (await rateLimit(principal, request) !== true) return denied;
      // Query is constructed from the server's parsed URL, not client JSON.
      const query = request.query;
      if (!query || typeof query.inviteId !== 'string' ||
          !Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 50) return denied;
      const invite = await loadInvite(query.inviteId);
      if (!authorizeHostInboxPreflight({ principal: { userId: principal.userId }, invite, query: {
        inviteId: query.inviteId, limit: query.limit
      } })) return denied;
      // readResponses must recheck host ownership in the SAME database transaction as
      // the private read; the preflight alone is not an authorization boundary.
      const rows = await readResponses({ hostUserId: principal.userId, inviteId: query.inviteId, limit: query.limit });
      if (!Array.isArray(rows) || rows.length > query.limit) return denied;
      const responses = rows.map(row => {
        if (!row || typeof row !== 'object' || typeof row.receiptId !== 'string' || !row.receiptId.trim() ||
            typeof row.choice !== 'string' || !['yes', 'maybe', 'no'].includes(row.choice) ||
            typeof row.savedAt !== 'string' || !Number.isFinite(Date.parse(row.savedAt))) throw new TypeError('Invalid private response');
        return { receiptId: row.receiptId, choice: row.choice, savedAt: row.savedAt };
      });
      return { status: 200, body: { responses } };
    } catch { return denied; }
  };
}
