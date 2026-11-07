// Trusted Node/server composition: never import into browser bundles.
// The database connection must be a private, least-privilege PostgreSQL role.
// Authentication and rate limiting are mandatory server-verified dependencies.
import { createPrivateEventApi } from './private-event-api.mjs';
import { createAtomicRsvpWriter } from './postgres-atomic-writer.mjs';
import { createPostgresHostInboxReader } from './postgres-host-inbox-reader.mjs';

export function createPostgresEventApi({ db, authenticate, rateLimitRsvp, rateLimitInbox,
  authorizeRecipient, loadInvite, readResponses }) {
  if (!db || typeof db.query !== 'function') throw new TypeError('Private PostgreSQL connection required');
  return createPrivateEventApi({
    authenticate, rateLimitRsvp, rateLimitInbox, authorizeRecipient,
    submitAtomic: createAtomicRsvpWriter(db), loadInvite,
    readResponses: readResponses ?? createPostgresHostInboxReader(db)
  });
}
