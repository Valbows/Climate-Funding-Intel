-- Minimal read policy draft for pipeline_runs
-- Allows authenticated users to read telemetry for dashboards; anon remains denied.

alter table public.pipeline_runs enable row level security; -- in case not enabled

create policy if not exists "Allow authenticated read"
  on public.pipeline_runs
  for select
  to authenticated
  using (true);
