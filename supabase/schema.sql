create extension if not exists "pgcrypto";

create table if not exists public.airdrops (
  id text primary key,
  project text not null,
  network text not null default 'solana',
  category text not null check (category in ('defi', 'nft', 'infrastructure', 'consumer')),
  status text not null check (status in ('upcoming', 'active', 'snapshot_taken', 'ended')),
  official_claim_url text not null,
  source_url text not null,
  verification_method text not null default 'unverified' check (verification_method in ('claim_api', 'distributor_program', 'manual_verified', 'unverified')),
  distributor_program_id text,
  claim_api_endpoint text,
  snapshot_proof_type text,
  last_verified_at timestamptz,
  source_confidence numeric not null default 0.5,
  verification_config jsonb not null default '{}'::jsonb,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  checks jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.airdrops add column if not exists verification_method text default 'unverified';
alter table public.airdrops add column if not exists distributor_program_id text;
alter table public.airdrops add column if not exists claim_api_endpoint text;
alter table public.airdrops add column if not exists snapshot_proof_type text;
alter table public.airdrops add column if not exists last_verified_at timestamptz;
alter table public.airdrops add column if not exists source_confidence numeric default 0.5;
alter table public.airdrops add column if not exists verification_config jsonb default '{}'::jsonb;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_airdrops_updated_at on public.airdrops;
create trigger trg_airdrops_updated_at
before update on public.airdrops
for each row
execute function public.set_updated_at();

alter table public.airdrops enable row level security;

create policy "Public read active airdrops"
on public.airdrops
for select
using (is_active = true);
create table if not exists public.airdrop_leads (
  id text primary key,
  project text not null,
  title text not null,
  summary text not null,
  url text not null,
  source_id text not null,
  source_name text not null,
  published_at timestamptz not null,
  score numeric not null,
  tags text[] not null default '{}',
  discovered_at timestamptz not null default now()
);

alter table public.airdrop_leads enable row level security;

create policy "Public read discovery leads"
on public.airdrop_leads
for select
using (true);
