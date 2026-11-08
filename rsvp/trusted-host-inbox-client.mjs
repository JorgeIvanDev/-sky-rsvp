// Same-origin browser adapter for the private host inbox. Never uses public Supabase RPCs.
export function createTrustedHostInboxClient({ fetcher, getAccessToken, endpoint = '/api/host-inbox' }) {
  if (typeof fetcher !== 'function' || typeof getAccessToken !== 'function' ||
      typeof endpoint !== 'string' || !/^\/[a-zA-Z0-9/_-]+$/.test(endpoint) ||
      endpoint.startsWith('//')) throw new TypeError('Trusted host inbox dependencies required');
  return async function getHostInbox(inviteId, limit = 25) {
    if (typeof inviteId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(inviteId) ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 50)
      throw new TypeError('Invalid inbox query');
    const token = await getAccessToken();
    if (typeof token !== 'string' || token.length > 8192 || !/^[\x21-\x7e]+$/.test(token))
      throw new Error('Host authentication required');
    const response = await fetcher(endpoint + '?inviteId=' + encodeURIComponent(inviteId) + '&limit=' + limit, {
      method: 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      referrerPolicy: 'no-referrer', headers: { Authorization: 'Bearer ' + token }
    });
    if (!response || response.ok !== true || response.status !== 200)
      throw new Error('Inbox unavailable');
    const body = await response.json();
    if (!body || !Array.isArray(body.responses) || body.responses.length > limit)
      throw new Error('Inbox unavailable');
    const seenReceipts = new Set();
    const rows = body.responses.map(row => {
      if (!row || typeof row.receiptId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(row.receiptId) ||
          !['yes', 'maybe', 'no'].includes(row.choice) ||
          typeof row.savedAt !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(row.savedAt) ||
          !Number.isFinite(Date.parse(row.savedAt)))
        throw new Error('Inbox unavailable');
      if (seenReceipts.has(row.receiptId)) throw new Error('Inbox unavailable');
      seenReceipts.add(row.receiptId);
      return Object.freeze({ receiptId: row.receiptId, choice: row.choice, savedAt: row.savedAt });
    });
    return Object.freeze(rows);
  };
}
