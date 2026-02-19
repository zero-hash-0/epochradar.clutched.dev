create extension if not exists "pgcrypto";

create table if not exists public.airdrops (
  id text primary key,
  project text not null,
  network text not null default 'solana',
  category text not null check (category in ('defi', 'nft', 'infrastructure', 'consumer')),
  status text not null check (status in ('upcoming', 'active', 'snapshot_taken', 'ended')),
  official_claim_url text not null,
  source_url text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  checks jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
