-- Indexes to optimize telemetry queries
-- Note: Do not use CONCURRENTLY in Supabase SQL editor as it runs in a transaction.

-- Speeds ORDER BY ts DESC and filters like ts >= <since>
create index if not exists idx_pipeline_runs_ts_desc
  on public.pipeline_runs (ts desc);

-- Speeds queries filtered by model and ordered by recent
create index if not exists idx_pipeline_runs_model_ts_desc
  on public.pipeline_runs (model, ts desc);
