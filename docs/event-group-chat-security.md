# Event group chat — private beta implementation contract

## Product behavior
- Organizer may enable chat per invitation (default OFF). RSVP screen explains that accepted guests can see the chat display name and messages before they opt in.
- A verified accepted RSVP gives the recipient eligibility to join; chat membership is **not** based on a client-supplied RSVP flag.
- Approved plus-ones may join only after the host approves the guest pass and the recipient accepts chat participation.
- Declining, withdrawing, being removed by host, or revoking participation immediately blocks reads, posts and subscriptions; preserve messages according to a disclosed retention policy, not indefinite silent retention.
- Event chat is archived after the event; host can disable chat and moderate messages. Never expose phone numbers or email addresses to other guests.
- An invite recipient must be able to RSVP without joining chat. Chat must never be required to unlock the RSVP.

## Authorization and data model
- `event_chats`: id, invite_id UNIQUE, enabled_by_host, created_at, archived_at.
- `event_chat_members`: chat_id, participant_user_id, display_name, joined_at, revoked_at; UNIQUE(chat_id, participant_user_id).
- `event_chat_messages`: id, chat_id, author_user_id, body, created_at, deleted_at; server-generated timestamps.
- Server-side membership verification must join authenticated principal -> accepted RSVP / approved guest pass -> invite -> chat. Host ownership must be verified independently.
- Never trust client-provided user_id, host_id, invite_id ownership, accepted status, or membership role.
- Use restrictive row-level security with defense in depth. Do not grant blanket SELECT/INSERT to authenticated users. Realtime must enforce the same membership authorization as message reads; reauthorize after revocation.
- Avoid public SECURITY DEFINER RPCs; if privileged operations are unavoidable, keep them in an unexposed schema with explicit grants, authenticated identity validation, and audited input limits.

## Abuse, safety, and privacy
- Message size <= 2000 Unicode characters; reject empty messages, URLs with dangerous schemes, and unsafe HTML. Render as text, never innerHTML.
- Rate limit writes per authenticated user and per event, with anti-spam enforcement on server. Bound history pagination and message count; block cross-event enumeration.
- Provide host remove/mute and participant leave/report controls. No precise location collection, contact scraping, or public participant directory.
- Notifications must not reveal message contents on shared devices unless user opts in.
- Minors require an age-appropriate design and review before public launch.

## Acceptance tests (must pass before enabling feature)
1. Guest A accepted event X: can read/post only in X after separately joining chat.
2. Guest B declined X: cannot read, post, subscribe, or enumerate X.
3. Guest C accepted event Y: cannot read X by changing IDs or Realtime topic.
4. Host of Y cannot moderate or read X.
5. Revoked/withdrawn member loses access to old and new messages and subscriptions.
6. Forged client acceptance, plus-one approval, and organizer flags confer no access.
7. Replayed message requests, burst spam, oversized payloads and HTML are rejected or safely handled.
8. Host disabling or archiving chat blocks new posts.
9. Guest can RSVP without opting into chat.
10. Cross-device tests show accepted guests can coordinate without exposing contact details.

## Delivery order
1. Complete secure transactional RSVP and host inbox (existing launch blocker).
2. Add schema and authorization tests with feature disabled.
3. Add server-side join/leave/send/history operations and verify denial tests.
4. Add event chat UI behind host opt-in, verify mobile and privacy.
5. Enable only after integration, security, and deployment verification.

This is an implementation specification, **not** a claim that chat is live.
