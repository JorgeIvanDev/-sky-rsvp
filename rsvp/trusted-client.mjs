// Browser-side adapter for a same-origin trusted server endpoint, NOT Supabase RPC.
// Access tokens are supplied per call by the auth layer and never stored here.
import { validateRsvpSubmission } from './rsvp-submit-policy.mjs';

export function createTrustedRsvpClient({ fetcher, getAccessToken, endpoint = '/api/rsvp' }) {
  if (typeof fetcher !== 'function' || typeof getAccessToken !== 'function' ||
      typeof endpoint !== 'string' || !/^\/[a-zA-Z0-9/_-]+$/.test(endpoint) ||
      endpoint.startsWith('//')) throw new TypeError('Trusted RSVP client dependencies required');
  return async function submitRsvp(input) {
    const payload = validateRsvpSubmission(input);
    const token = await getAccessToken();
    if (typeof token !== 'string' || token.length > 8192 || !/^[\x21-\x7e]+$/.test(token))
      throw new Error('RSVP authentication required');
    const response = await fetcher(endpoint, {
      method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload)
    });
    if (!response || response.ok !== true || response.status !== 200)
      throw new Error('RSVP unavailable');
    const receipt = await response.json();
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) ||
        typeof receipt.receiptId !== 'string' || !receipt.receiptId.trim() ||
        receipt.choice !== payload.choice || typeof receipt.savedAt !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(receipt.savedAt) ||
        !Number.isFinite(Date.parse(receipt.savedAt)))
      throw new Error('RSVP unavailable');
    return Object.freeze({
      receiptId: receipt.receiptId, choice: receipt.choice, savedAt: receipt.savedAt
    });
  };
}
