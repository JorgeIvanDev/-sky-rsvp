// Server-only composition root. Dependencies must be provided by a trusted runtime.
// No Supabase service role key, JWT secret, or client-provided identity belongs here.
import { createPrivateRsvpHandler } from './private-rsvp-handler.mjs';
import { createPrivateHostInboxHandler } from './private-host-inbox-handler.mjs';
import { createRsvpHttpRouter } from './trusted-http-router.mjs';

export function createPrivateEventApi({ authenticate, rateLimitRsvp, rateLimitInbox,
  authorizeRecipient, submitAtomic, loadInvite, readResponses }) {
  const submitRsvp = createPrivateRsvpHandler({
    authenticate, rateLimit: rateLimitRsvp, authorizeRecipient, submitAtomic
  });
  const getHostInbox = createPrivateHostInboxHandler({
    authenticate, rateLimit: rateLimitInbox, loadInvite, readResponses
  });
  return createRsvpHttpRouter({ submitRsvp, getHostInbox });
}
