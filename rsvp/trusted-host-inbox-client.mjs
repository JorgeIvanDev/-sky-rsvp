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
    if (typeof token !== 'string' || !token.trim() || /[\r\n]/.test(token))
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
    const rows = body.responses.map(row => {
      if (!row || typeof row.receiptId !== 'string' || !row.receiptId.trim() ||
          !['yes', 'maybe', 'no'].includes(row.choice) ||
          typeof row.savedAt !== 'string' || !Number.isFinite(Date.parse(row.savedAt)))
        throw new Error('Inbox unavailable');
      return Object.freeze({ receiptId: row.receiptId, choice: row.choice, savedAt: row.savedAt });
    });
    return Object.freeze(rows);
  };
}
