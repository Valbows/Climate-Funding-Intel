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
