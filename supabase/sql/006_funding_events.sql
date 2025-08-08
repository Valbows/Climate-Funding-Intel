-- 006_funding_events.sql
-- Creates the funding_events table used by the frontend and ingestion pipeline.
-- Safe to run multiple times (IF NOT EXISTS on objects where possible).

-- Enable extension required for gen_random_uuid
create extension if not exists pgcrypto;

create table if not exists public.funding_events (
  id uuid primary key default gen_random_uuid(),
  startup_name text not null,
  geography text,
  funding_stage text,
  amount_raised_usd numeric,
  lead_investor text,
  funding_date date,
  source_url text unique,
  sub_sector text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- RLS
alter table public.funding_events enable row level security;

-- Policy: public read
create policy if not exists "Public read access" on public.funding_events
  for select using (true);

-- Policy: service role insert
create policy if not exists "Allow writes from service role" on public.funding_events
  for insert with check (auth.role() = 'service_role');

-- Helpful indexes
create index if not exists idx_funding_events_date on public.funding_events (funding_date desc);
create index if not exists idx_funding_events_sector on public.funding_events (sub_sector);
