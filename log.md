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
