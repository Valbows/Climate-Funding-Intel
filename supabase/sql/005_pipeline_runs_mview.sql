-- Materialized view for daily telemetry summaries
-- Drops and recreates to ensure consistent definition.

-- Remove existing mview if present
DROP MATERIALIZED VIEW IF EXISTS public.pipeline_runs_daily;

-- Create daily summary materialized view
CREATE MATERIALIZED VIEW public.pipeline_runs_daily AS
SELECT
  date_trunc('day', ts)::date AS day,
  model,
  status,
  count(*) AS runs,
  sum(raw_count) AS raw_sum,
  sum(validated_count) AS valid_sum,
  avg(duration_ms)::numeric(12,2) AS duration_avg_ms
FROM public.pipeline_runs
GROUP BY 1,2,3;

-- Unique index to support FAST refresh-like reads
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_runs_daily_unique
  ON public.pipeline_runs_daily (day, model, status);

-- Allow authenticated users to read the materialized view for dashboards
GRANT SELECT ON public.pipeline_runs_daily TO authenticated;

-- Helper to refresh the materialized view
CREATE OR REPLACE FUNCTION public.refresh_pipeline_runs_daily()
RETURNS void
LANGUAGE sql
AS $$
  REFRESH MATERIALIZED VIEW public.pipeline_runs_daily;
$$;

COMMENT ON MATERIALIZED VIEW public.pipeline_runs_daily IS 'Daily aggregated telemetry metrics for dashboards';
COMMENT ON FUNCTION public.refresh_pipeline_runs_daily() IS 'Refreshes the daily telemetry materialized view';
