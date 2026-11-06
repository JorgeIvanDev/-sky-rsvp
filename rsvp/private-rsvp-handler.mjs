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
      if (!identity || typeof identity.userId !== 'string') return denied;
      // Rate limit before parsing/authorization; keyed by server-verified identity and
      // server-observed network signals, never a client-supplied recipient ID alone.
      if (await rateLimit(identity, request) !== true) return denied;
      const input = validateRsvpSubmission(request.body);
      if (await authorizeRecipient(identity, input.inviteId, input.recipientId) !== true) return denied;
      // submitAtomic must use a private DB connection, invoke the locked SQL transaction,
      // and bind p_user_id ONLY from authenticate(), never from request.body.
      const receipt = await submitAtomic({ ...input, userId: identity.userId });
      if (!receipt || typeof receipt.receiptId !== 'string' ||
          receipt.choice !== input.choice || typeof receipt.savedAt !== 'string') return denied;
      return { status: 200, body: { receiptId: receipt.receiptId, choice: receipt.choice, savedAt: receipt.savedAt } };
    } catch {
      return denied;
    }
  };
}
