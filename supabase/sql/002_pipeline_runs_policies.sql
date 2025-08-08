-- Minimal read policy draft for pipeline_runs
-- Allows authenticated users to read telemetry for dashboards; anon remains denied.

alter table public.pipeline_runs enable row level security; -- in case not enabled

drop policy if exists "Allow authenticated read" on public.pipeline_runs;

create policy "Allow authenticated read"
  on public.pipeline_runs
  for select
  to authenticated
  using (true);
