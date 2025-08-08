-- Telemetry table for pipeline runs
-- Apply via Supabase SQL editor or CLI

create schema if not exists public;

create table if not exists public.pipeline_runs (
  id bigserial primary key,
  ts timestamptz not null default now(),
  model text not null,
  raw_count integer not null default 0,
  sanitized_valid_count integer not null default 0,
  sanitized_dropped_count integer not null default 0,
  validated_count integer not null default 0,
  validation_dropped_count integer not null default 0,
  duration_ms integer not null default 0,
  status text not null check (status in ('ok','error')),
  error text
);

comment on table public.pipeline_runs is 'Telemetry for Climate Funding Intel pipeline runs';
comment on column public.pipeline_runs.ts is 'UTC timestamp of the run';
comment on column public.pipeline_runs.model is 'LLM model id used for the run';
comment on column public.pipeline_runs.duration_ms is 'Total run duration in milliseconds';
comment on column public.pipeline_runs.status is 'ok or error';
comment on column public.pipeline_runs.error is 'Error message if status=error';

-- Enable RLS; service role bypasses RLS by design.
alter table public.pipeline_runs enable row level security;

-- No policies created: deny all for anon/auth. Service role will still be able to insert.
-- Add read policies later if a dashboard needs to query this table from the frontend.
