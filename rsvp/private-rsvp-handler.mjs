// Trusted-server adapter only. Never expose database credentials or this transaction via PostgREST.
// Dependencies must be supplied by a server runtime, not by browser request data.
import { validateRsvpSubmission } from './rsvp-submit-policy.mjs';

export function createPrivateRsvpHandler({ authenticate, authorizeRecipient, rateLimit, submitAtomic }) {
  if ([authenticate, authorizeRecipient, rateLimit, submitAtomic].some(fn => typeof fn !== 'function'))
    throw new TypeError('Trusted RSVP dependencies required');
  return async function submitRsvp(request) {
    // All failures intentionally share a generic response to avoid recipient enumeration.
    const denied = Object.freeze({ status: 403, body: { error: 'RSVP unavailable' } });
    try {
      if (!request || request.method !== 'POST') return denied;
      const identity = await authenticate(request);
      if (!identity || typeof identity.userId !== 'string' || !identity.userId.trim()) return denied;
      // Rate limit before parsing/authorization; keyed by server-verified identity and
      // server-observed network signals, never a client-supplied recipient ID alone.
      if (await rateLimit(identity, request) !== true) return denied;
      const input = validateRsvpSubmission(request.body);
      if (await authorizeRecipient(identity, input.inviteId, input.recipientId) !== true) return denied;
      // submitAtomic must use a private DB connection, invoke the locked SQL transaction,
      // and bind p_user_id ONLY from authenticate(), never from request.body.
      const receipt = await submitAtomic({ ...input, userId: identity.userId });
      // Treat DB adapter output as untrusted: accessors/prototypes can execute code
      // during receipt validation and must never influence the public response.
      if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) ||
          (Object.getPrototypeOf(receipt) !== Object.prototype && Object.getPrototypeOf(receipt) !== null)) return denied;
      const descriptors = Object.getOwnPropertyDescriptors(receipt);
      if (['receiptId', 'choice', 'savedAt'].some(key =>
          !Object.prototype.hasOwnProperty.call(descriptors, key) ||
          !Object.prototype.hasOwnProperty.call(descriptors[key], 'value'))) return denied;
      const safeReceipt = Object.fromEntries(['receiptId', 'choice', 'savedAt'].map(key => [key, descriptors[key].value]));
      if (typeof safeReceipt.receiptId !== 'string' ||
          !/^[A-Za-z0-9_-]{1,128}$/.test(safeReceipt.receiptId) ||
          safeReceipt.choice !== input.choice || typeof safeReceipt.savedAt !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(safeReceipt.savedAt) ||
          (!Number.isFinite(Date.parse(safeReceipt.savedAt)) ||
           new Date(safeReceipt.savedAt).toISOString().slice(0, 19) !==
             safeReceipt.savedAt.slice(0, 19))) return denied;
      return { status: 200, body: { receiptId: safeReceipt.receiptId, choice: safeReceipt.choice, savedAt: safeReceipt.savedAt } };
    } catch {
      return denied;
    }
  };
}
