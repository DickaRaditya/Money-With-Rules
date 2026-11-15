-- Money With Rules: metadata only. Balances, policies, and merchant authority live on chain.
begin;

create table public.profiles (
  wallet text primary key check (wallet ~ '^0x[0-9a-f]{40}$'),
  display_name text not null check (length(display_name) between 1 and 80),
  role text not null check (role in ('parent','child','merchant')),
  updated_at timestamptz not null default now()
);
create table public.child_relationships (
  parent_wallet text not null check (parent_wallet ~ '^0x[0-9a-f]{40}$'),
  child_wallet text not null check (child_wallet ~ '^0x[0-9a-f]{40}$'),
  label text not null check (length(label) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (parent_wallet, child_wallet),
  check (parent_wallet <> child_wallet)
);
create table public.merchant_applications (
  wallet text primary key check (wallet ~ '^0x[0-9a-f]{40}$'),
  name text not null check (length(name) between 1 and 100),
  location text not null check (length(location) <= 200),
  logo_url text check (length(logo_url) <= 500),
  category integer not null check (category between 0 and 3),
  description text not null check (length(description) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text check (length(review_note) <= 500),
  reviewed_by text,
  updated_at timestamptz not null default now()
);
create table public.auth_nonces (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  nonce text not null unique,
  message text not null,
  chain_id integer not null check (chain_id in (31337,84532)),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index auth_nonces_wallet_created on public.auth_nonces(wallet, created_at);
create table public.wallet_sessions (
  token_hash text primary key,
  wallet text not null,
  chain_id integer not null check (chain_id in (31337,84532)),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  chain_id integer not null,
  vault text not null,
  budget_id text not null,
  merchant text not null,
  amount text not null,
  tx_hash text,
  status text not null check (status in ('submitted','confirmed','reverted','failed')),
  reason text check (length(reason) <= 300),
  created_at timestamptz not null default now()
);
create index attempts_wallet_created on public.payment_attempts(wallet, created_at desc);
create unique index attempts_transaction on public.payment_attempts(chain_id, tx_hash) where tx_hash is not null;

-- All browser roles are denied by both grants and RLS. Wallet sessions use a server
-- gateway, not Supabase Auth JWTs: never invent auth.uid() policies for wallet addresses.
alter table public.profiles enable row level security;
alter table public.child_relationships enable row level security;
alter table public.merchant_applications enable row level security;
alter table public.auth_nonces enable row level security;
alter table public.wallet_sessions enable row level security;
alter table public.payment_attempts enable row level security;
revoke all on public.profiles, public.child_relationships, public.merchant_applications,
  public.auth_nonces, public.wallet_sessions, public.payment_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.profiles, public.child_relationships, public.merchant_applications,
  public.auth_nonces, public.wallet_sessions, public.payment_attempts to service_role;

-- Serialized per-wallet nonce issuance prevents a race around the rate limit.
create function public.issue_wallet_nonce(p_wallet text, p_nonce text, p_message text, p_chain integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_wallet, 1));
  if (select count(*) from public.auth_nonces where wallet = p_wallet and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'RATE_LIMIT';
  end if;
  insert into public.auth_nonces(wallet, nonce, message, chain_id, expires_at)
  values (p_wallet, p_nonce, p_message, p_chain, now() + interval '5 minutes') returning id into result;
  return result;
end $$;

-- Called only AFTER signature verification. Atomic consumption and session creation
-- ensure concurrent valid requests cannot turn one signature into two sessions.
create function public.consume_wallet_nonce(p_id uuid, p_token_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed public.auth_nonces%rowtype;
begin
  update public.auth_nonces set consumed_at = now()
  where id = p_id and consumed_at is null and expires_at > now()
  returning * into claimed;
  if not found then return false; end if;
  insert into public.wallet_sessions(token_hash, wallet, chain_id, expires_at)
  values (p_token_hash, claimed.wallet, claimed.chain_id, now() + interval '8 hours');
  return true;
end $$;
revoke all on function public.issue_wallet_nonce(text,text,text,integer) from public, anon, authenticated;
revoke all on function public.consume_wallet_nonce(uuid,text) from public, anon, authenticated;
grant execute on function public.issue_wallet_nonce(text,text,text,integer) to service_role;
grant execute on function public.consume_wallet_nonce(uuid,text) to service_role;
commit;
