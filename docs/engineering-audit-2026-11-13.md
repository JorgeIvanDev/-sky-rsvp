# CNIDARIA engineering audit — 2026-11-13

Repository scan: active Pages entry points include index.html, multiplayer-beta.html, meeting-checkin.html, host-live.html, and CNT lab; multiple independent RSVP/motion/wallet prototypes and test suites. No bulk deletion or unverified consolidation.

Supabase project hwkxuczipnaqzhbnaurw also contains farm_* tables. Never modify farm tables or default authentication Site URL without assessing shared consumers.

Verified live beta: two distinct authenticated accounts joined a meeting; status reached completed. Known issues: old UI showed check-in after completion (fixed); email OTP rate limit (Google link used); previously recursive RLS and ambiguous PL/pgSQL names (fixed).

This batch: added authenticated invitation preview RPC and member-scoped lobby RPC; shared pure frontend helpers and Node regression tests; invitation preview, lobby progress, action-state gating.

Security: Supabase advisor flags SECURITY DEFINER RPC exposure intentionally restricted to authenticated; each must enforce auth.uid() and membership/token checks. RLS-disabled? Check advisors regularly. Invite token is still stored as raw UUID text in a column named token_hash; **hash at rest** before production and provide revocation. OAuth uses browser fragment tokens and localStorage; replace with hardened PKCE-based auth and strict CSP before production. Physical toss proof and BSV settlement not implemented.

Remaining: real-device acceptance tests for invitation preview and lobby; review all individual source modules and CI workflows; add real-time subscriptions; challenge schema and proof verification; deployment smoke.
