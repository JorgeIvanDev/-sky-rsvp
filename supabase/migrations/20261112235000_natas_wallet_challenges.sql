-- Optional Natas wallet-link challenges. NOT applied automatically.
-- Service-role-only operations; never expose these RPCs to browser clients.
create table if not exists public.natas_wallet_challenges (
  nonce_hash text primary key check (nonce_hash ~ '^[0-9a-f]{64}$'),
  player_id text not null,
  wallet_address text not null,
  origin text not null,
  challenge_hash text not null check (challenge_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.natas_wallet_challenges enable row level security;
revoke all on public.natas_wallet_challenges from public, anon, authenticated;
-- Atomic consumption prevents two concurrent requests from reusing a signature.
create or replace function public.natas_consume_wallet_challenge(p_nonce_hash text)
returns table(player_id text, wallet_address text, origin text, challenge_hash text, expires_at timestamptz)
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_nonce_hash is null or p_nonce_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;
  return query
    delete from public.natas_wallet_challenges c
    where c.nonce_hash = p_nonce_hash
    returning c.player_id, c.wallet_address, c.origin, c.challenge_hash, c.expires_at;
end;
$$;
revoke all on function public.natas_consume_wallet_challenge(text) from public, anon, authenticated;
grant execute on function public.natas_consume_wallet_challenge(text) to service_role;
grant select, insert, delete on public.natas_wallet_challenges to service_role;
