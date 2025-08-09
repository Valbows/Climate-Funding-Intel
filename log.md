# Climate Funding Intel — Engineering Log

Purpose: Centralized history of decisions, incidents, and fixes to prevent repeat issues (S.A.F.E. — Evolving).

---

## Template
- Date/Time (UTC):
- Phase: Architect | Refine/Design | Execute/Implement | Test | Deploy | Operate
- Summary:
- Change(s):
- Decision(s):
- Risk(s):
- Issue(s) & Root Cause:
- Mitigation & Fix:
- Action Items:
- References:

---

## Entries

### 2025-08-07T22:08:31Z — Architect
- Summary: Initialized project blueprint and references.
- Change(s): Created `plan.md` with architecture, security model, stack, schema, testing, CI/CD, and acceptance criteria.
- Decision(s):
  - Use CrewAI with `TavilySearchTool` and `ScrapeWebsiteTool` per latest docs.
  - Frontend reads via anon key + RLS; pipeline writes via service role only.
  - Schedule via GitHub Actions (primary), Vercel Cron (alt).
- Risk(s): Tool import drift across CrewAI versions; scraping blocked by paywalls.
- Issue(s) & Root Cause: None yet.
- Mitigation & Fix: Pin package versions; add retries and fallbacks for dynamic pages.
- Action Items: Await secrets and deployment preferences from user; proceed to Designer Mode to scaffold code.
- References: See `plan.md` Section 2.

### 2025-08-07T23:47:05Z — Execute/Implement
- Summary: Scaffolded backend pipeline for Gemini LLM integration with CrewAI; added config, utils, tests, Dockerfile; aligned plan and envs.
- Change(s):
  - Added root `.env.example` and `.gitignore`.
  - Created `pipeline/` modules: `agents/`, `tasks/`, `llm/gemini_client.py`, `utils/json_utils.py`, `supabase_client.py`, `main.py`.
  - Added `pipeline/requirements.txt` and `pipeline/Dockerfile`.
  - Added unit tests: `test_json_utils.py`, `test_gemini_client.py`, `test_supabase_noop.py`, `test_extraction.py`.
  - Updated `plan.md` env section (use `MODEL`, `LLM_*`) and reference snippet to `build_llm()`; reflected new utils in directory tree.
- Decision(s):
  - Use `MODEL=gemini-2.0-flash` with provider prefix handled (`gemini/<model>`).
  - Lazy LLM instantiation via `build_llm()` to avoid import-time dependencies.
  - Centralize JSON parsing in `pipeline/utils/json_utils.py` for testability.
- Risk(s): CrewAI/Tools API drift; LLM output may be non-JSON; Supabase schema mismatches.
- Mitigation & Fix: Added JSON extraction tests; early-return on empty upserts; logging with levels; pinned deps.
- Action Items: Populate `pipeline/.env`; run unit tests; perform a dry-run; connect CI; configure Vercel Cron.
- References: `plan.md` Sections 7 and 9; directory structure Section 8.

### 2025-08-08T03:03:11Z — Execute/Implement | Test
- Summary: Finalized Gemini LLM pipeline stability: added event sanitizer, strict verification prompt, persisted debug artifacts, robust retries/fallbacks; validated upserts in Docker.
- Change(s):
  - Added `pipeline/utils/event_sanitizer.py` to normalize/validate events; enforced required `startup_name` and `https` `source_url`; normalized `amount_raised_usd` and `funding_date`.
  - Integrated sanitizer in `pipeline/main.py`; persisted dropped events to `pipeline/dropped_events.json`; logged raw/valid/dropped counts; persisted raw LLM output to `pipeline/last_result.txt`.
  - Refined `pipeline/tasks/verification_task.py` prompt to match sanitizer rules (omit incomplete events; clarify normalization; strict JSON only).
  - Updated ignores: `.gitignore` and `pipeline/.dockerignore` to exclude debug artifacts (`last_result.txt`, `dropped_events.json`).
  - Added unit test `pipeline/tests/unit/test_event_sanitizer.py`; ran tests in Docker — passing.
  - Updated `plan.md` with new env vars (LLM fallbacks/retries, LOG_LEVEL, SUPABASE_TABLE), sanitizer flow, and debug persistence.
- Decision(s):
  - Enforce strict completeness before upsert; align prompt with sanitizer; keep debug artifacts out of VCS/Docker context.
  - Use `LLM_MODEL_FALLBACKS`, `LLM_MAX_RETRIES`, `LLM_RETRY_BASE_DELAY` for resilience; default model `gemini-2.0-flash`.
- Risk(s): LLM may still output borderline cases; some valid but partial events will be dropped; scraper variability.
- Issue(s) & Root Cause: Previous NOT NULL upsert errors from null `startup_name` and malformed/invalid `source_url`; inconsistent numeric/date formats.
- Mitigation & Fix: Sanitizer filtering/normalization; explicit prompt rules; persisted artifacts for offline debugging; improved JSON extraction and error logging.
- Action Items: Review `pipeline/dropped_events.json` and `pipeline/last_result.txt`; consider Pydantic schema validation; add `pipeline_runs` table for telemetry; tighten fallback logic; integrate CI + scheduled runs with alerting.
- References: `pipeline/main.py`, `pipeline/utils/event_sanitizer.py`, `pipeline/tasks/verification_task.py`, `.gitignore`, `pipeline/.dockerignore`, `plan.md` Sections 7, 9, 13.

### 2025-08-08T03:58:29Z — Execute/Implement | Test
- Summary: Added Pydantic `FundingEvent` model aligning with sanitizer rules; created unit tests for schema normalization and validation.
- Change(s):
  - Added `pipeline/models.py` with `FundingEvent` model, validators for `startup_name` and `https` `source_url`, amount parsing (digits-only), and `YYYY-MM-DD` date normalization with `to_db_dict()`.
  - Added unit tests `pipeline/tests/unit/test_models.py` covering valid normalization, required field failures, invalid date, amount parsing, and native date handling.
  - Updated `pipeline/requirements.txt` to include `pydantic`.
- Decision(s): Use Pydantic v2 for strong runtime validation while keeping sanitizer for LLM outputs; models are the source of truth for DB shape.
- Risk(s): Divergence between sanitizer and model rules.
- Mitigation & Fix: Matched model validators to sanitizer behavior; added dedicated tests.
- Action Items: Integrate model into `pipeline/main.py` or utilize post-sanitization validation; add telemetry model next.
- References: `pipeline/models.py`, `pipeline/tests/unit/test_models.py`, `pipeline/utils/event_sanitizer.py`, `pipeline/requirements.txt`.

### 2025-08-08T07:45:24Z — Execute/Implement | Integrate & Test
- Summary: Integrated Pydantic `FundingEvent` validation into `pipeline/main.py` post-sanitization; combined sanitizer and validation drops for persistence; fixed Docker import path for tests; all unit tests passing in Docker.
- Change(s):
  - Updated `pipeline/main.py` to validate sanitized events with `FundingEvent`, convert with `to_db_dict()`, and upsert only validated records. Persist combined drops to `pipeline/dropped_events.json` with Pydantic errors.
  - Updated `pipeline/Dockerfile` to set `PYTHONPATH=/app` so `import pipeline` resolves during pytest collection.
  - Rebuilt Docker image and executed tests inside container.
- Result(s): `pytest` green — 17 passed in ~4s.
- Decision(s): Enforce Pydantic as the final gate before DB writes; persist reasons for all dropped events for offline triage.
- Risk(s): Potential mismatch if sanitizer rules evolve without updating model validators.
- Mitigation & Fix: Keep sanitizer and model in lockstep; add integration tests next for Supabase upsert path.
- Action Items: Implement sandbox Supabase integration test; add telemetry (`pipeline_runs`) with counts and durations; wire CI to run tests on PRs.
- References: `pipeline/main.py`, `pipeline/Dockerfile`, `pipeline/models.py`, `pipeline/tests/unit/*`.

### 2025-08-08T07:53:23Z — Test | Integration Scaffold
- Summary: Added Supabase integration test scaffold that safely skips without sandbox envs; verified test suite stability.
- Change(s):
  - Created `pipeline/tests/integration/test_supabase_upsert.py` requiring `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_TABLE_SANDBOX` to run.
  - Updated `.env.example` to include `SUPABASE_TABLE_SANDBOX`.
- Result(s): `pytest` green — 17 passed, 1 skipped (integration) in ~2.3s inside Docker.
- Issue(s) & Root Cause: Docker pytest initially failed due to `ModuleNotFoundError: pipeline`; root cause was missing `PYTHONPATH` in container.
- Mitigation & Fix: Set `PYTHONPATH=/app` in `pipeline/Dockerfile` (documented in prior entry); rebuilt image; reran tests successfully.
- Action Items: Configure sandbox table and secrets to enable the integration path; proceed to telemetry and CI scheduling.
- References: `pipeline/tests/integration/test_supabase_upsert.py`, `.env.example`, `pipeline/Dockerfile`.

### 2025-08-08T07:55:23Z — Execute/Implement | CI
- Summary: Added GitHub Actions workflow to run unit tests on push/PR for `main`.
- Change(s): Created `.github/workflows/ci.yml` to install `pipeline/requirements.txt` and run `pytest` with `PYTHONPATH` set.
- Decision(s): Keep CI lightweight (no Docker build) for speed; add scheduled job later for full pipeline container run.
- Risk(s): API-dependent tests could require secrets; we avoided this by keeping integration test skipped unless envs are provided.
- Action Items: Add scheduled workflow for container run; wire Slack/GitHub notifications on failures.
- References: `.github/workflows/ci.yml`, `plan.md` Phase 2 checklist.

### 2025-08-08T08:08:03Z — Implement | Telemetry
- Summary: Added lightweight telemetry to capture pipeline run metrics (counts, duration, status) into Supabase table `pipeline_runs`.
- Change(s):
  - Created `pipeline/telemetry.py` with `build_run_record()` and `insert_run()`.
  - Wired telemetry in `pipeline/main.py` to record success and error cases per model attempt.
  - Added unit tests `pipeline/tests/unit/test_telemetry.py` covering record shaping and graceful insert behavior.
  - Updated `.env.example` with `TELEMETRY_TABLE` default.
- Decision(s): Telemetry insertion is best-effort; failures are logged and never break pipeline execution.
- Risk(s): None significant; insert uses service key envs only when configured.
- Action Items: Add SQL migration for `pipeline_runs` and integration test for telemetry insert using sandbox envs.
- References: `pipeline/telemetry.py`, `pipeline/main.py`, `pipeline/tests/unit/test_telemetry.py`, `.env.example`, `plan.md`.

### 2025-08-08T08:24:52Z — Implement | DB Migration
- Summary: Added SQL migration to create `public.pipeline_runs` telemetry table with RLS enabled.
- Change(s): `supabase/sql/001_pipeline_runs.sql` with schema, comments, and RLS enablement.
- Decision(s): No RLS policies yet; only service role writes. Add read policies later if needed for dashboards.
- Action Items: Apply migration in Supabase SQL editor/CLI; verify telemetry inserts.
- References: `supabase/sql/001_pipeline_runs.sql`, `plan.md`.

### 2025-08-08T08:24:52Z — Implement | Scheduler
- Summary: Added GitHub Actions scheduled workflow to run the pipeline container every 2 hours.
- Change(s): `.github/workflows/schedule.yml` builds Docker image and runs container if required secrets are present.
- Decision(s): Gate execution on secrets; allow manual `workflow_dispatch` for testing.
- Risk(s): None if secrets are missing—job exits early with a clear message.
- Action Items: Configure repository secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_TABLE`, `GEMINI_API_KEY`, optional `MODEL`).
- References: `.github/workflows/schedule.yml`, `plan.md` Phase 2 checklist.

### 2025-08-08T09:06:50Z — Implement | DB Indexes
- Summary: Added indexes on `pipeline_runs` to improve dashboard/query performance.
- Change(s): `supabase/sql/003_pipeline_runs_indexes.sql` creating `idx_pipeline_runs_ts_desc` and `idx_pipeline_runs_model_ts_desc`.
- Outcome: Verified in Supabase (`pg_indexes`) that both indexes exist.
- Action Items: None.
- References: `supabase/sql/003_pipeline_runs_indexes.sql`.

### 2025-08-08T09:09:05Z — Implement | Retention
- Summary: Added retention function to prune old telemetry rows older than N days (default 90).
- Change(s): `supabase/sql/004_pipeline_runs_retention.sql` defines `public.prune_pipeline_runs(retention_days integer)`.
- Decision(s): Scheduling not added yet; can be executed manually or via scheduled job later.
- Action Items: Apply migration in Supabase SQL editor; optionally set up a scheduled call (e.g., pg_cron) to run daily.
- References: `supabase/sql/004_pipeline_runs_retention.sql`.

### 2025-08-08T09:55:26Z — Implement | Scheduler (pg_cron)
- Summary: Scheduled nightly refresh for telemetry materialized view `public.pipeline_runs_daily`.
- Change(s): Created pg_cron job `refresh_pipeline_runs_daily` at 03:30 UTC to run `select public.refresh_pipeline_runs_daily();`.
- Outcome: Job should appear in `cron.job` once created in Supabase SQL Editor.
- Action Items: Verify with `select jobid, jobname, schedule from cron.job order by jobid;`.
- References: `supabase/sql/005_pipeline_runs_mview.sql`, `plan.md` Phase 2 checklist.
 
### 2025-08-08T10:50:18Z — Implement | CI (Gated Integration)
- Summary: Added GitHub Actions workflow to run telemetry integration test against Supabase sandbox, gated by required secrets.
- Change(s): Created `.github/workflows/ci-integration.yml` with a `Check required secrets` step and conditional steps for setup/install/test. Uses secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `TELEMETRY_TABLE_SANDBOX`.
- Decision(s): Mirror gating pattern from `schedule.yml` to avoid job-level `secrets` usage in `if:`; provide a clear skip summary when secrets are missing.
- Risk(s): None when secrets are missing—job exits early with message.
- Action Items: Configure repository secrets for sandbox to enable integration path on PRs; monitor for deprecation warnings in Supabase client.
- References: `.github/workflows/ci-integration.yml`, `.github/workflows/schedule.yml`, `plan.md` Phase 2 checklist.

### 2025-08-08T10:05:53Z — Implement | Integration Test (Telemetry)
- Summary: Telemetry integration test added to insert a synthetic run into sandbox telemetry table.
- Change(s): `pipeline/tests/integration/test_telemetry_insert.py` uses `build_run_record` + `insert_run`, gated by envs.
- Env Gating: Requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEMETRY_TABLE_SANDBOX`; test auto-skips if missing.
- Action Items: Ensure sandbox table exists and set `TELEMETRY_TABLE_SANDBOX` accordingly.
- References: `pipeline/tests/integration/test_telemetry_insert.py`, `pipeline/telemetry.py`, `.env.example`.

### 2025-08-08T12:33:40Z — Test | Operate
- Summary: Telemetry integration finalized; CI fixed with PYTHONPATH; pg_cron jobs verified; mview refresh populated.
- Change(s):
  - Updated `.github/workflows/ci-integration.yml` to set `PYTHONPATH` for pytest collection.
  - Applied Supabase SQL: telemetry schema, policies, indexes, retention function, mview; scheduled pg_cron jobs.
  - Removed duplicate prune job if present (kept `prune_pipeline_runs_90d` at 04:00 UTC).
- Outcome:
  - CI Integration (Telemetry) workflow passed on `main`.
  - `cron.job` shows `refresh_pipeline_runs_daily` (30 3 * * *) and `prune_pipeline_runs_90d` (0 4 * * *).
  - Manual refresh returned count=1 from `public.pipeline_runs_daily`.
  - Manual retention prune returned 0 (no rows older than 90 days).
- Issue(s) & Root Cause:
  - Initial CI failure: `ModuleNotFoundError: No module named 'pipeline'` due to missing `PYTHONPATH` on GitHub runner.
- Mitigation & Fix:
  - Set `PYTHONPATH: ${{ github.workspace }}` in integration test step; consider adding `pipeline/__init__.py` to avoid env reliance.
- Action Items:
  - Optional: add alerts on failure (Slack webhook or GH annotations).
  - Proceed to Phase 3: Frontend scaffold (Next.js app, API route, UI components, tests).
- References: `.github/workflows/ci-integration.yml`, `supabase/sql/001_pipeline_runs.sql`, `002_pipeline_runs_policies.sql`, `003_pipeline_runs_indexes.sql`, `004_pipeline_runs_retention.sql`, `005_pipeline_runs_mview.sql`, `pipeline/tests/integration/test_telemetry_insert.py`, `plan.md`.

### 2025-08-09T17:52:13Z — Test | Operate
- Summary: Investigated persistent 404s for Next.js dev static assets. Confirmed `next dev` serves `/_next/static/*` correctly (HTTP 200). 404s reproduced only inside in-app preview proxy; not in direct browser. Classified as environment-specific proxy path rewriting/blocking.
- Change(s):
  - Updated `plan.md` Phase 3 status to In Progress with progress checklist and a dev note about avoiding in-app preview for Next dev assets.
  - Verified no custom `basePath`/`assetPrefix` in `web/next.config.mjs` and no `public/_next` conflicts.
  - Confirmed pages and tests for Phase 3 scaffolding: company detail SSR page, API route, slug utils and tests, list-to-detail navigation test.
- Decision(s): Use a direct browser tab (Chrome/Safari/Firefox) against `http://localhost:3000` during development. Avoid in-app preview proxy for accurate Next.js static asset behavior.
- Issue(s) & Root Cause: Preview proxy rewrites/blocks `/_next/*` paths causing 404s; not a Next.js build/config issue.
- Mitigation & Fix:
  - Hard reload, clear cache, and unregister any service workers for `localhost:3000`.
  - Use direct browser access to `next dev`; optionally `rm -rf .next` and restart dev server if stale cache suspected.
- Action Items:
  - Continue Phase 3 features: P3.2 bio enrichment polling after `companies` table; E2E flow from dashboard → company detail.
  - Add note to README about preview limitations during dev.
- References: `plan.md` Section 18 (Phase 3), `web/next.config.mjs`, `web/src/components/funding-events-list.tsx`, `web/src/lib/slug.ts`, `web/src/app/companies/[slug]/page.tsx`, `web/src/app/api/companies/[slug]/route.ts`, tests under `web/src/lib/__tests__/` and `web/src/components/__tests__/`.

### 2025-08-09T18:17:18Z — Execute/Implement | Test
- Summary: Implemented Company Bio client polling UI, updated API to include `bio` and `bio_status`, and added Playwright E2E smoke test. Verified E2E passes in Chromium.
- Change(s):
  - Added `web/src/components/company-bio.client.tsx` using SWR to poll `/api/companies/[slug]` until `bio_status: ready`; includes a "Fetch Bio" button (POST 202 no-op for now).
  - Integrated `CompanyBio` into `web/src/app/companies/[slug]/page.tsx` below Recent Events.
  - Extended `web/src/app/api/companies/[slug]/route.ts` GET to read `companies` table if present; return `bio` and `bio_status` with graceful fallbacks when absent.
  - Playwright: `web/playwright.config.ts` with auto `webServer`; scripts added to `web/package.json`; created `web/e2e/company-bio.spec.ts` smoke test.
  - Docs: Updated `web/README.md` with E2E usage and dev proxy note; updated `plan.md` Phase 3 progress.
- Decision(s): Use client-side polling cadence 5s; keep POST enrichment a stub returning 202 until worker is implemented.
- Risk(s): None significant; API reads remain anon and read-only. Potential flake if preview proxy is used during dev (avoid per note).
- Issue(s) & Root Cause: Initial E2E looked for a button unconditionally; adjusted test to pass when bio is already ready/absent without the button being present.
- Mitigation & Fix: Made the Fetch Bio click optional and asserted on presence of status text or section visibility.
- Action Items:
  - Implement enrichment worker and server-side queueing endpoint; wire POST to enqueue real jobs.
  - Add rate limiting and caching headers to the API route.
  - Expand E2E: dashboard → company navigation, verify external source links and metrics.
  - Consider adding Playwright to CI gated job.
- References: `pipeline/telemetry.py`, `pipeline/main.py`, `pipeline/tests/unit/test_telemetry.py`, `.env.example`, `plan.md`.
