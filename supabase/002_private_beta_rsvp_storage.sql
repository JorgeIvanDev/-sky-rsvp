-- CNIDARIA private-beta RSVP storage foundation (NOT an enabled endpoint).
-- Apply only in an isolated test database after review. No client-side grants or RPCs.
-- Never treat an invite link as recipient authentication.
create table if not exists public.cnidaria_beta_recipients (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.cnidaria_invites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (invite_id, user_id),
  unique (id, invite_id)
);

-- The challenge row is a server-issued one-attempt authorization record.
-- Evidence verification and issuance MUST happen in a trusted backend; never
-- let clients insert or mark these rows as verified.
create table if not exists public.cnidaria_beta_challenges (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null,
  recipient_id uuid not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  verified_at timestamptz,
  consumed_at timestamptz,
  revoked_at timestamptz,
  constraint beta_challenge_recipient_fk foreign key (recipient_id, invite_id)
    references public.cnidaria_beta_recipients(id, invite_id) on delete cascade,
  constraint beta_challenge_expiry check (expires_at > issued_at and expires_at <= issued_at + interval '5 minutes'),
  constraint beta_challenge_consume_verified check (consumed_at is null or verified_at is not null),
  constraint beta_challenge_verified_before_consume check (consumed_at is null or consumed_at >= verified_at),
  unique (id, recipient_id, invite_id)
);

-- One receipt per recipient/invite. The unique challenge binding prevents
-- two receipts from claiming the same challenge; idempotency is per recipient.
-- A trusted transactional service must lock the challenge row, check recipient
-- identity, expiration, revocation and verification, and insert the receipt
-- plus consumed_at update in ONE database transaction.
create table if not exists public.cnidaria_beta_rsvp_receipts (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null,
  recipient_id uuid not null,
  challenge_id uuid not null,
  idempotency_hash text not null check (idempotency_hash ~ '^[a-f0-9]{64}$'),
  choice text not null check (choice in ('yes', 'maybe', 'no')),
  submitted_at timestamptz not null default now(),
  constraint beta_receipt_recipient_fk foreign key (recipient_id, invite_id)
    references public.cnidaria_beta_recipients(id, invite_id) on delete cascade,
  constraint beta_receipt_challenge_fk foreign key (challenge_id, recipient_id, invite_id)
    references public.cnidaria_beta_challenges(id, recipient_id, invite_id),
  unique (invite_id, recipient_id),
  unique (recipient_id, idempotency_hash),
  unique (challenge_id)
);
create index if not exists cnidaria_beta_recipients_user_idx
  on public.cnidaria_beta_recipients(user_id);
create index if not exists cnidaria_beta_receipts_invite_idx
  on public.cnidaria_beta_rsvp_receipts(invite_id, submitted_at desc);

alter table public.cnidaria_beta_recipients enable row level security;
alter table public.cnidaria_beta_challenges enable row level security;
alter table public.cnidaria_beta_rsvp_receipts enable row level security;
alter table public.cnidaria_beta_recipients force row level security;
alter table public.cnidaria_beta_challenges force row level security;
alter table public.cnidaria_beta_rsvp_receipts force row level security;
-- No RLS policies: fail closed even if table privileges are later granted.
revoke all on table public.cnidaria_beta_recipients from public, anon, authenticated;
revoke all on table public.cnidaria_beta_challenges from public, anon, authenticated;
revoke all on table public.cnidaria_beta_rsvp_receipts from public, anon, authenticated;
-- SECURITY NOTE: FORCE RLS does not constrain BYPASSRLS/service-role access.
-- A trusted service still needs authorization, rate limits, audit, and atomic
-- SQL tests before any production usage. No organizer inbox access is exposed.
