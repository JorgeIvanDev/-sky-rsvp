// Same-origin browser adapter for the private host inbox. Never uses public Supabase RPCs.
export function createTrustedHostInboxClient({ fetcher, getAccessToken, endpoint = '/api/host-inbox' }) {
  if (typeof fetcher !== 'function' || typeof getAccessToken !== 'function' ||
      endpoint !== '/api/host-inbox') throw new TypeError('Trusted host inbox dependencies required');
  return async function getHostInbox(inviteId, limit = 25) {
    if (typeof inviteId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(inviteId) ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 50)
      throw new TypeError('Invalid inbox query');
    let token;
    try { token = await getAccessToken(); }
    catch { throw new Error('Host authentication required'); }
    if (typeof token !== 'string' || token.length === 0 || token.length > 8192 || !/^[A-Za-z0-9._~+/-]+={0,2}$/.test(token))
      throw new Error('Host authentication required');
    let response;
    try { response = await fetcher(endpoint + '?inviteId=' + encodeURIComponent(inviteId) + '&limit=' + limit, {
      method: 'GET', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      referrerPolicy: 'no-referrer', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }
    }); }
    catch { throw new Error('Inbox unavailable'); }
    if (!response || response.ok !== true || response.status !== 200)
      throw new Error('Inbox unavailable');
    // A private inbox must never parse an HTML redirect or ambiguous media type.
    let contentType;
    try { contentType = response.headers?.get?.('content-type'); }
    catch { throw new Error('Inbox unavailable'); }
    if (typeof contentType !== 'string' ||
        !/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(contentType))
      throw new Error('Inbox unavailable');
    let body;
    try { body = await response.json(); }
    catch { throw new Error('Inbox unavailable'); }
    try {
    if (!body || !Array.isArray(body.responses) || body.responses.length > limit)
      throw new Error('Inbox unavailable');
    const seenReceipts = new Set();
    const rows = body.responses.map(row => {
      if (!row || typeof row.receiptId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(row.receiptId) ||
          !['yes', 'maybe', 'no'].includes(row.choice) ||
          typeof row.savedAt !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(row.savedAt) ||
          (!Number.isFinite(Date.parse(row.savedAt)) ||
           new Date(row.savedAt).toISOString().slice(0, 19) !== row.savedAt.slice(0, 19)))
        throw new Error('Inbox unavailable');
      if (seenReceipts.has(row.receiptId)) throw new Error('Inbox unavailable');
      seenReceipts.add(row.receiptId);
      return Object.freeze({ receiptId: row.receiptId, choice: row.choice, savedAt: row.savedAt });
    });
    return Object.freeze(rows);
    } catch { throw new Error('Inbox unavailable'); }
  };
}
