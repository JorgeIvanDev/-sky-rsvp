// Browser-side adapter for a same-origin trusted server endpoint, NOT Supabase RPC.
// Access tokens are supplied per call by the auth layer and never stored here.
import { validateRsvpSubmission } from './rsvp-submit-policy.mjs';

export function createTrustedRsvpClient({ fetcher, getAccessToken, endpoint = '/api/rsvp' }) {
  if (typeof fetcher !== 'function' || typeof getAccessToken !== 'function' ||
      endpoint !== '/api/rsvp') throw new TypeError('Trusted RSVP client dependencies required');
  let pending = false;
  return async function submitRsvp(input) {
    if (pending) throw new Error('RSVP submission already in progress');
    pending = true;
    try {
    const payload = validateRsvpSubmission(input);
    let token;
    try {
      token = await getAccessToken();
    } catch {
      // Authentication provider failures may contain private session details.
      throw new Error('RSVP authentication required');
    }
    if (typeof token !== 'string' || token.length === 0 || token.length > 8192 || !/^[A-Za-z0-9._~+/-]+={0,2}$/.test(token))
      throw new Error('RSVP authentication required');
    let response;
    try {
      response = await fetcher(endpoint, {
      method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload)
    });
    } catch {
      // Network and transport failures must not disclose upstream details to guests.
      throw new Error('RSVP unavailable');
    }
    // Custom fetch adapters can expose throwing accessors; never leak their errors.
    let accepted;
    try { accepted = response?.ok === true && response.status === 200; }
    catch { throw new Error('RSVP unavailable'); }
    if (!accepted) throw new Error('RSVP unavailable');
    // Reject explicitly non-JSON responses (for example an HTML login redirect)
    // before parsing any body. Older fetch adapters may omit headers.
    let contentType;
    try { contentType = response.headers?.get?.('content-type'); }
    catch { throw new Error('RSVP unavailable'); }
    if (contentType != null && (typeof contentType !== 'string' ||
        !/^application\/json(?:\s*;|\s*$)/i.test(contentType)))
      throw new Error('RSVP unavailable');
    // Do not expose upstream parse errors or response bodies to the invitation UI.
    let receipt;
    try {
      receipt = await response.json();
    } catch {
      throw new Error('RSVP unavailable');
    }
    // Reject accessor/prototype-backed receipts before reading any fields.
    // A custom fetch adapter must not be able to execute getters in the UI path.
    let fields;
    try {
      if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) ||
          (Object.getPrototypeOf(receipt) !== Object.prototype && Object.getPrototypeOf(receipt) !== null))
        throw new Error();
      fields = Object.getOwnPropertyDescriptors(receipt);
      for (const key of ['receiptId', 'choice', 'savedAt']) {
        if (!Object.prototype.hasOwnProperty.call(fields, key) ||
            !Object.prototype.hasOwnProperty.call(fields[key], 'value')) throw new Error();
      }
      receipt = Object.fromEntries(['receiptId', 'choice', 'savedAt'].map(key => [key, fields[key].value]));
    } catch {
      throw new Error('RSVP unavailable');
    }
    if (typeof receipt.receiptId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(receipt.receiptId) ||
        receipt.choice !== payload.choice || typeof receipt.savedAt !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(receipt.savedAt) ||
        (!Number.isFinite(Date.parse(receipt.savedAt)) ||
         new Date(receipt.savedAt).toISOString().slice(0, 19) !==
           receipt.savedAt.slice(0, 19)))
      throw new Error('RSVP unavailable');
    return Object.freeze({
      receiptId: receipt.receiptId, choice: receipt.choice, savedAt: receipt.savedAt
    });
    } finally {
      pending = false;
    }
  };
}
