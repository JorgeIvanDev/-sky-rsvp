-- Private-beta recipient revocation. Apply only after 002 in an isolated reviewed database.
-- Authorization preflight requires a non-revoked recipient; persist that state.
-- No public RPCs, policies, or client grants are introduced.
alter table public.cnidaria_beta_recipients
  add column if not exists revoked_at timestamptz;

-- Prevent a revoked recipient's outstanding challenge from being used by
-- a trusted service that checks both recipient revocation and challenge state.
-- Existing receipts are retained for audit; reads remain server-authorized.
create index if not exists cnidaria_beta_recipients_active_user_idx
  on public.cnidaria_beta_recipients (user_id, invite_id)
  where revoked_at is null;

alter table public.cnidaria_beta_recipients enable row level security;
alter table public.cnidaria_beta_recipients force row level security;
revoke all on table public.cnidaria_beta_recipients from public, anon, authenticated;

-- IMPORTANT: revoked_at alone is NOT a transaction guard. The future trusted
-- RSVP transaction MUST lock/read this recipient row and require revoked_at IS NULL
-- in the same transaction as challenge consumption and receipt insertion.
