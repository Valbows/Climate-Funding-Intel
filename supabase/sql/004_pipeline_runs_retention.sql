-- Retention function for telemetry table
-- Deletes rows older than N days (default 90)

create or replace function public.prune_pipeline_runs(retention_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.pipeline_runs
  where ts < now() - (retention_days || ' days')::interval;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.prune_pipeline_runs(integer) is 'Deletes rows older than N days from public.pipeline_runs and returns number of rows deleted.';
