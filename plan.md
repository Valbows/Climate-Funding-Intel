# Climate Funding Intel — S.A.F.E. D.R.Y. A.R.C.H.I.T.E.C.T. Plan

Version: 0.1 (Architect Phase)
Date: 2025-08-07
Owner: Cascade (Senior Software Architect) + User (Project Manager)

---

## 1) Project Goal & Scope
Status: Completed — 2025-08-08T03:27:32Z

Build an automated, reliable pipeline that discovers, verifies, structures, and publishes climate-tech startup funding events, with a secure frontend for search and filtering.

- Problem: Funding news is fragmented and unstructured.
- Solution: A scheduled CrewAI multi-agent pipeline that searches (Tavily), verifies/structures (Gemini), and stores results (Supabase). A Next.js site displays and filters events.
- Non-goals: Editorial analysis and prediction modeling (future work).


## 2) References (Authoritative)
Status: Completed — 2025-08-08T03:27:32Z

- CrewAI Introduction: https://docs.crewai.com/en/introduction
- CrewAI Installation: https://docs.crewai.com/en/installation
- CrewAI Quickstart: https://docs.crewai.com/en/quickstart
- CrewAI Build Your First Crew: https://docs.crewai.com/en/guides/crews/first-crew
- CrewAI Tools (Concepts): https://docs.crewai.com/en/concepts/tools
- CrewAI Tavily Search Tool: https://docs.crewai.com/en/tools/search-research/tavilysearchtool
- CrewAI Scrape Website Tool: https://docs.crewai.com/en/tools/web-scraping/scrapewebsitetool
- CrewAI Web-scraping Overview: https://docs.crewai.com/en/tools/web-scraping/overview
- CrewAI Open Source (site): https://www.crewai.com/open-source
- CrewAI GitHub: https://github.com/crewAIInc/crewAI
- Tavily: https://www.tavily.com/
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- CIS Benchmarks: https://www.cisecurity.org/cis-benchmarks


## 3) Architecture Overview
Status: Completed — 2025-08-08T03:27:32Z

High-level: two main parts — an AI Data Pipeline (backend) and a Next.js Web App (frontend), with Supabase as the data platform.

- AI Data Pipeline (Python, CrewAI)
  - Agent 1 (Researcher): uses Tavily search to find recent climate-tech funding news (Energy & Grid focus).
  - Agent 2 (Verifier/Extractor): uses scraping + Gemini to read articles and extract structured fields.
  - Output: Upsert structured JSON into Supabase `funding_events` with dedupe by `source_url`.
- Database (Supabase/PostgreSQL)
  - Table: `funding_events` with RLS; public read allowed via anon key; writes restricted to service role.
- Frontend (Next.js)
  - API route fetches `funding_events` (read-only via anon key) sorted by `funding_date`.
  - UI provides search, filters, and auto-refresh (SWR/React Query). Shows “Last Updated”.
- Automation/Scheduling
  - Containerized pipeline run every 2 hours via GitHub Actions schedule or Vercel Cron (alternate: VM cron).

Data flow (text diagram):
```
[Scheduler] --> [Pipeline (CrewAI)] --(structured JSON)--> [Supabase]
                                                   ^
                      [Tavily] + [ScrapeWebsiteTool] + [Gemini]

[Next.js] --(select via anon key/API route)--> [Supabase] --(JSON)--> [UI]
```


## 4) Security Model (S.A.F.E.)
Status: Completed — 2025-08-08T03:27:32Z

- Secrets separation
  - Pipeline: uses Supabase `SERVICE_ROLE_KEY`, Tavily API key, Gemini/Vertex AI key. Never exposed to the frontend.
  - Frontend: uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` only.
- RLS enforced for `funding_events`; anonymous reads allowed; inserts only with service role from pipeline.
- Least privilege: no service keys in client or serverless API routes that can be invoked publicly.
- Scraping safeguards
  - Prefer CrewAI `ScrapeWebsiteTool` for controlled content access. Consider whitelisting domains; set timeouts; disable JS execution unless necessary; limit depth.
- OWASP Top 10 mitigation highlights
  - A01: Broken Access Control — RLS policies and server vs client key separation.
  - A02: Cryptographic Failures — Use HTTPS; secrets in env vars; never commit secrets.
  - A03: Injection — Parameterized queries (supabase client); validate/sanitize scraper outputs.
  - A05: Security Misconfiguration — Harden Docker images; pin dependencies; minimal images.
  - A06: Vulnerable Components — Dependabot/Actions to scan; pin versions; SAST (bandit, ruff, ESLint).
  - A08: Software/Data Integrity — Signed builds; locked dependencies; CI verifies checksums where possible.
- Compliance: No PII expected. If later storing people names/emails, revisit privacy and consent.


## 5) Technology Stack & Versions
Status: Completed — 2025-08-08T03:27:32Z

- Backend
  - Python 3.11 (>=3.10 OK)
  - crewai (pinned), crewai_tools (pinned)
  - google-generativeai (selected) using model gemini-2.0-flash; Vertex AI SDK optional alternative
  - supabase (Python client)
  - pydantic, requests, tenacity (retry), python-dotenv
  - Quality/Security: ruff, mypy, bandit, pytest
- Frontend
  - Node 20 LTS
  - Next.js 14 + TypeScript, SWR or React Query, Shadcn UI (Radix + Tailwind CSS)
  - @supabase/supabase-js v2
  - Testing: Jest + React Testing Library, Playwright (E2E)
- Automation/Infra
  - Docker (python:3.11-slim), GitHub Actions (cron + CI), Vercel (frontend), optional ZAP baseline scan


## 6) Database Schema (Supabase)
Status: Completed — 2025-08-08T03:27:32Z

DDL (run in Supabase SQL Editor):
```sql
CREATE TABLE IF NOT EXISTS funding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_name TEXT NOT NULL,
  geography TEXT,
  funding_stage TEXT,
  amount_raised_usd NUMERIC,
  lead_investor TEXT,
  funding_date DATE,
  source_url TEXT UNIQUE,
  sub_sector TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE funding_events ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access" ON funding_events
  FOR SELECT USING (true);

-- Service-role writes only
CREATE POLICY "Allow writes from service role" ON funding_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_funding_events_date ON funding_events (funding_date DESC);
CREATE INDEX IF NOT EXISTS idx_funding_events_sector ON funding_events (sub_sector);
```


## 7) Environment Variables
Status: Completed — 2025-08-08T03:27:32Z

- Root: `.env.example` (copy values into respective env files below; never commit real secrets)
- Pipeline (`pipeline/.env`)
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - SUPABASE_TABLE (default: funding_events)
  - TAVILY_API_KEY
  - GEMINI_API_KEY
  - MODEL (selected: gemini-2.0-flash)
  - LLM_MODEL_FALLBACKS (comma-separated optional)
  - LLM_TEMPERATURE (default 0.2)
  - LLM_TIMEOUT (seconds, default 120)
  - LLM_MAX_TOKENS (default 4000)
  - LLM_SEED (default 42)
  - LOG_LEVEL (default INFO)
  - LLM_MAX_RETRIES (default 3)
  - LLM_RETRY_BASE_DELAY (seconds, default 30)
  - Alternative (Vertex): VERTEX_AI_JSON (service account) + PROJECT_ID + LOCATION + MODEL
- Frontend (`web/.env.local`)
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY


## 8) Directory Structure (Monorepo)
Status: Completed — 2025-08-08T03:27:32Z

```
climate-funding-intel/
  plan.md
  log.md
  README.md
  docs/
    architecture.md
    references.md
  pipeline/
    agents/
      researcher.py
      verifier.py
    tasks/
      research_task.py
      verification_task.py
    llm/
      gemini_client.py
    utils/
      json_utils.py
      event_sanitizer.py
    supabase_client.py
    main.py
    requirements.txt
    Dockerfile
    .dockerignore
    tests/
      unit/
        test_extraction.py
        test_tasks.py
        test_json_utils.py
        test_event_sanitizer.py
      integration/
        test_supabase_upsert.py
  web/
    package.json
    next.config.js
    pages/
      api/
        funding-events.ts
      index.tsx
    components/
      Header.tsx
      Filters.tsx
      DataTable.tsx
    styles/
      globals.css
    tests/
      unit/
      e2e/
        playwright.config.ts
  .github/
    workflows/
      ci.yml
      pipeline-cron.yml
      zap-baseline.yml (optional)
  vercel.json (optional for cron)
```


## 9) CrewAI Design (Agents, Tools, Tasks)
Status: Completed — 2025-08-08T03:27:32Z

- Tools
  - Tavily: `from crewai_tools import TavilySearchTool`
  - Web scraping: `from crewai_tools import ScrapeWebsiteTool`
- Agents
  - Researcher: role="Expert Climate Tech Investment Researcher" (Tavily tool, verbose)
  - Verifier: role="Data Verification and Structuring Specialist" (ScrapeWebsiteTool + LLM)
- Tasks
  - Task 1: Search since Jan 2025 for Energy/Grid funding round articles; output a newline list of URLs.
  - Task 2: For each URL, extract fields: startup_name, geography, funding_stage, amount_raised_usd, lead_investor, funding_date (YYYY-MM-DD), sub_sector, source_url.
- Process: `Process.sequential`; result aggregated to JSON: `{ "events": [ ... ] }`.
- Upsert: `on_conflict='source_url'` to dedupe.

 - Sanitization & Validation
   - After verification JSON extraction, normalize and validate with `pipeline/utils/event_sanitizer.py`.
   - Required: non-empty `startup_name`; valid `https` `source_url`.
   - Normalize: `amount_raised_usd` to integer (digits only); `funding_date` to `YYYY-MM-DD` or null.
   - Persist dropped events to `pipeline/dropped_events.json`; log counts of raw/valid/dropped.
   - Verification prompt explicitly omits incomplete events to align with sanitizer rules.

Note: Some older examples reference `TavilySearchResults`; current docs standardize on `TavilySearchTool`. We will pin CrewAI versions and verify imports in CI.


### Reference Snippets

1) Current pattern using TavilySearchTool + ScrapeWebsiteTool

```python
# pipeline/main.py
from crewai import Agent, Task, Crew, Process
from crewai_tools import TavilySearchTool, ScrapeWebsiteTool
# Build Gemini LLM via CrewAI wrapper for model 'gemini-2.0-flash'
from pipeline.llm.gemini_client import build_llm

tavily_tool = TavilySearchTool()
scrape_tool = ScrapeWebsiteTool()

llm = build_llm()

researcher = Agent(
  role='Expert Climate Tech Investment Researcher',
  goal='Find and report on the latest funding rounds in the Energy and Grid climate tech sector.',
  backstory='Meticulous financial analyst tracking VC activity in energy and grid.',
  verbose=True,
  allow_delegation=False,
  tools=[tavily_tool],
  llm=llm
)

verifier = Agent(
  role='Data Verification and Structuring Specialist',
  goal='Verify funding details from URLs and return database-ready JSON.',
  backstory='Detail-oriented data analyst turning unstructured text into structured records.',
  verbose=True,
  allow_delegation=False,
  tools=[scrape_tool],
  llm=llm
)

research_task = Task(
  description=(
    "Search for recent (since January 2025) funding news for 'Energy and Grid' startups. "
    "Focus on: seed, Series A/B, venture capital, raised, investment. Output a list of URLs."
  ),
  expected_output='A raw list of URLs, each on a new line.',
  agent=researcher
)

verification_task = Task(
  description=(
    "For each URL, extract: startup_name, geography, funding_stage, amount_raised_usd, "
    "lead_investor, funding_date (YYYY-MM-DD), sub_sector, source_url; null if missing."
  ),
  expected_output=(
    "A JSON object: {'events': [{...}]} where each dict is a funding event."
  ),
  agent=verifier
)
```

2) Legacy example using TavilySearchResults (requested snippet)

```python
# In your python backend script (e.g., pipeline/main.py)
from crewai import Agent
from crewai_tools import TavilySearchResults
from your_llm_setup import gemini_llm  # A wrapper for the Gemini LLM

# Initialize tools
tavily_tool = TavilySearchResults(api_key="YOUR_TAVILY_API_KEY")

# Agent 1: Researcher
researcher = Agent(
  role='Expert Climate Tech Investment Researcher',
  goal='Find and report on the latest funding rounds in the Energy and Grid climate tech sector from publicly available news sources.',
  backstory="You are a meticulous financial analyst specializing in tracking venture capital. You read press releases, financial news, and tech blogs to identify recent, significant funding events for startups in the energy and grid space.",
  verbose=True,
  allow_delegation=False,
  tools=[tavily_tool],
  llm=gemini_llm  # Use Gemini for reasoning
)

# Agent 2: Verifier
verifier = Agent(
  role='Data Verification and Structuring Specialist',
  goal='Verify the funding details from provided URLs and extract the information into a clean, structured JSON format.',
  backstory="You are a detail-oriented data analyst. Your strength is reading unstructured text and turning it into perfect, database-ready JSON. You double-check every detail for accuracy before finalizing your output.",
  verbose=True,
  allow_delegation=False,
  # This agent needs a tool to read web page content.
  # We will define this tool in the next step.
  tools=[...],
  llm=gemini_llm  # Use Gemini for extraction
)

# In pipeline/main.py
from crewai import Task

# Task 1: Find funding articles
research_task = Task(
  description=(
    "Search for recent (since January 2025) news articles and press releases about funding rounds for startups in the 'Energy and Grid' sector. "
    "Focus on terms like 'seed funding', 'Series A', 'Series B', 'venture capital', 'raised', 'investment'. "
    "Provide a list of URLs of the most promising articles."
  ),
  expected_output='A raw list of URLs, each on a new line, pointing to articles about climate tech funding events.',
  agent=researcher
)

# Task 2: Verify and extract data from the articles
verification_task = Task(
  description=(
    "For each URL provided, read the content and extract the following information: "
    "Startup Name, Geography (Country/City), Funding Stage (e.g., Seed, Series A), "
    "Amount Raised (in USD), Lead Investor, Funding Date (YYYY-MM-DD), and Sub-Sector (e.g., Energy Storage, Grid Modernization). "
    "Omit any event missing required fields: non-empty startup_name and a valid https source_url. "
    "Optional fields may be null. Normalize amount_raised_usd to digits-only integer and funding_date to YYYY-MM-DD if present."
  ),
  expected_output=(
    "Strict JSON only (no code fences). Return exactly one object of the form { 'events': [ { ... } ] } where each item is a funding event. "
    "Example: {'events': [{'startup_name': 'Gridlytics', 'amount_raised_usd': 5000000, ...}]}"
  ),
  agent=verifier
)
```


## 10) Scheduling Options

- Vercel Cron (primary, selected)
  - Configure `vercel.json` to hit a secure Next.js API route that triggers the pipeline orchestration.
  - Ensure route requires a secret token to prevent public abuse.
- GitHub Actions (alternative)
  - `on: schedule: cron: "0 */2 * * *"` -> build and run the pipeline container with env secrets.
- Cloud VM Cron (alternative)
  - `0 */2 * * * /usr/local/bin/docker run ...` with secrets.


## 11) Testing Strategy (Automated)

- Python (pytest)
  - Unit: JSON extraction shape validation; task prompt composition; URL list parsing; retry logic.
  - Integration: Supabase upsert with a temporary table or sandbox schema; dedupe by `source_url`.
- Frontend
  - Unit/UI: Jest + React Testing Library for filters, table rendering, empty states.
  - E2E: Playwright flows — load page, apply filters, see results, last updated shows ISO timestamp.
- Security/Quality
  - bandit (Python), ruff (lint), mypy (type), ESLint/TypeScript strict.
  - Optional ZAP baseline scan against deployed preview URL.


## 12) CI/CD

- `ci.yml`
  - Matrix jobs: pipeline (lint, type-check, tests), web (lint, type-check, unit tests), build artifacts.
- `pipeline-cron.yml`
  - Scheduled run builds and executes the pipeline with env secrets stored in GitHub.
- Vercel
  - Connect repo, set frontend env vars, auto-deploy on push; Preview + Production.


## 13) Logging & Observability
Status: Completed — 2025-08-08T03:27:32Z

- Pipeline logs to stdout (JSON format). Persist debug artifacts for offline diagnosis:
  - `pipeline/last_result.txt` — raw LLM output (ignored by Git and Docker build context).
  - `pipeline/dropped_events.json` — events removed by sanitizer with reasons (ignored).
  - Consider a `pipeline_runs` table (counts, duration, errors) for telemetry.
- Frontend: console suppressed in production; add basic error boundaries; consider Sentry later.


## 14) Performance & SLOs

- Data freshness: <= 2 hours.
- Pipeline run duration: < 10 minutes.
- Frontend initial load (P95): < 2s on Vercel Edge; Lighthouse performance > 90.


## 15) Accessibility & UX (DRY + Laws of UX)

- Simple filters (Hick’s Law). Clear grouping (Proximity). Prominent “Last Updated” (Von Restorff). Sensible defaults (Jakob’s Law). Minimal copy (Krug’s Laws). Keyboard navigable. WCAG 2.1 AA.


## 16) Risks, Assumptions, Blind Spots
Status: Completed — 2025-08-08T03:27:32Z

- LLM Provider Choice: Decide between `google-generativeai` vs Vertex AI Python SDK.
- Extraction Reliability: Articles with paywalls or dynamic loading; may require Selenium tool or Firecrawl tool.
- Domain Whitelisting: Balance breadth vs safety for scraping.
- Supabase Limits: Row throughput and RLS behavior under load; plan indexes accordingly.
- Rate Limits/Costs: Tavily, Gemini usage; set caps and backoff.
- Timezone Handling: Normalize all times to UTC; ensure consistent `funding_date` extraction.


## 17) What We Need From You (Blocking Inputs)
Status: Completed — 2025-08-08T03:27:32Z

- Supabase: Project URL, anon key, service_role key.
- Google Gemini: API key (or Vertex service account JSON + project/location/model).
- Tavily: API key.
- Project naming confirmation (currently: `climate-funding-intel`).
- Deployment preference: GitHub Actions vs Vercel Cron vs VM.
- Frontend design choice: Tailwind only vs MUI components.


## 18) Phase Plan (You provided — enhanced, not removed)

 - Phase 0: System Architecture & Setup (this document). Create Supabase table + policies; prepare env/secrets. — Status: Completed — 2025-08-08T03:40:39Z
 - Phase 1: Backend Pipeline — Status: In Progress — 2025-08-08T03:53:23-04:00
   - [x] Implement agents, tasks, tools
   - [x] LLM client (Gemini) with fallbacks, retries, timeouts
   - [x] Event sanitizer and strict prompt alignment
   - [x] Supabase upsert with schema adherence and dedupe by `source_url`
   - [x] Persist debug artifacts (`last_result.txt`, `dropped_events.json`) and logging
   - [x] Unit tests for extraction and sanitizer
   - [ ] Integration test: end-to-end Supabase upsert (sandbox table)
     - Scaffold added; test skips unless Supabase env and sandbox table are configured
   - [x] Pydantic schema for funding events (stronger validation)
   - [x] Integrate Pydantic validation gate in `pipeline/main.py` (post-sanitization)
   - [x] Telemetry integration (client-side): record counts, duration, status; insert into `TELEMETRY_TABLE` (default `pipeline_runs`)
   - [x] SQL migration file added for `pipeline_runs` with RLS (see `supabase/sql/001_pipeline_runs.sql`)
   - [x] Read policy migration draft for authenticated read (see `supabase/sql/002_pipeline_runs_policies.sql`)
   - [x] Apply migrations in Supabase
   - [x] Index migration for telemetry table (see `supabase/sql/003_pipeline_runs_indexes.sql`)
   - [x] Add integration tests for telemetry insert (see `pipeline/tests/integration/test_telemetry_insert.py`)
  - Phase 2: Automation & Scheduling — Status: Partially Completed — 2025-08-08T03:40:39Z
     - [x] Dockerize pipeline (`pipeline/Dockerfile`, `.dockerignore`)
     - [x] CI: GitHub Actions workflow to run unit tests on push/PR
     - [x] CI: Gated telemetry integration workflow (`.github/workflows/ci-integration.yml`)
      - [x] Vercel Cron (primary) configured to trigger API route
      - [x] GitHub Actions schedule (interim/alt) to run pipeline container
      - [x] Secrets configured in GitHub/Vercel project settings
      - [ ] Alerts on failure (job annotations; optional Slack webhook)
      - Notes: Added verification scripts `pipeline/scripts/insert_test_telemetry.py` and `pipeline/scripts/check_telemetry.py` to validate telemetry.
      - [x] pg_cron: schedule nightly refresh of `public.pipeline_runs_daily` at 03:30 UTC (`refresh_pipeline_runs_daily`)
      - [x] pg_cron: daily retention prune at 04:00 UTC (`prune_pipeline_runs_90d`)
      - [x] CI Integration (Telemetry) passing on `main`
  - Phase 3: Frontend Web App — Status: In Progress — 2025-08-09T18:17:18Z
    - Progress (as of 2025-08-09T18:17:18Z):
      - [x] Internal routing to company pages via `next/link`; kept "View Source" icon button opening `source_url` in a new tab (`rel="noopener noreferrer"`).
      - [x] Server-rendered company detail page at `web/src/app/companies/[slug]/page.tsx` querying Supabase, aggregating totals, and listing events with external sources.
      - [x] Slug utilities at `web/src/lib/slug.ts` with unit tests `web/src/lib/__tests__/slug.test.ts`.
      - [x] Funding list link test `web/src/components/__tests__/funding-events-list.link.test.tsx`; pagination behavior/UI adjusted to always render the container when results ≥ 1 to satisfy tests.
      - [x] API route `web/src/app/api/companies/[slug]/route.ts` returning aggregated company data including `bio` and `bio_status` with graceful fallbacks when `companies` table is absent.
      - [x] Example env file `web/.env.local.example` for frontend setup.
      - [x] P3.2 bio enrichment polling wiring (client + API polling in place; pending enrichment worker/`companies` table):
        - Client `CompanyBio` with SWR polling every 5s until `bio_status: ready`.
        - Button to POST to `/api/companies/[slug]` (returns 202) for manual enrichment trigger (no-op for now).
        - Integrated into company page under Recent Events.
      - [x] E2E setup (Playwright): config + smoke test for Company Bio section; dev server auto-start via Playwright `webServer`.
      - Dev note: In development, 404s for `/_next/static/*` were observed only in the in-app preview proxy; direct browser requests returned 200. Use a direct browser tab for dev and avoid the preview proxy for Next dev assets.
    - P3.0 (Immediate UX fix): Route event clicks to internal company pages
      - Change `web/src/components/funding-events-list.tsx` rows from external anchors (`source_url`) to internal links using `next/link` -> `/companies/[slug]`.
      - Keep a small "View Source" icon/button per row or in the detail page that opens `source_url` in a new tab with `rel="noopener noreferrer"`.
      - Compute `slug` from `startup_name` via a shared util (e.g., `slugify(name)`).
   - P3.1 Company Detail Page (SSR-friendly, Server Component)
     - New route: `web/src/app/companies/[slug]/page.tsx`.
     - Data: query Supabase `funding_events` filtered by normalized `startup_name` derived from `slug`.
       - Show: company name, sector/sub-sector chips, last funding round, total raised (sum of amounts), list of recent events with dates and investors, and external sources.
       - Style: use brand accent `var(--accent)` for badges/section titles; maintain accessibility (focus rings, roles/ARIA).
   - P3.2 Company Bio Enrichment (MVP, asynchronous)
     - Add lightweight API: `GET /api/companies/[slug]` returns joined company profile + aggregated events.
       - If bio missing/stale (e.g., `last_enriched_at IS NULL OR older than 30d`), enqueue an enrichment job and return current data with `bio_status: pending`.
     - UI: the detail page renders a placeholder/skeleton for Bio and auto-polls the API (SWR) until `bio_status: ready`.
   - P3.3 Database: `companies` table (read-only to public; writes by pipeline/service)
     - Columns (proposed):
       - `id UUID PK DEFAULT gen_random_uuid()`, `slug TEXT UNIQUE`, `name TEXT NOT NULL`, `website TEXT`, `bio TEXT`, `logo_url TEXT`, `hq_city TEXT`, `hq_country TEXT`, `founded_year INT`, `sectors TEXT[]`, `sources JSONB[]`, `last_enriched_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`.
     - RLS: allow anon `SELECT`; restrict `INSERT/UPDATE` to service role.
     - Optional view: `company_with_funding_summary` computing `total_raised`, `last_round`, `last_round_date` from `funding_events`.
   - P3.4 Enrichment Worker (optional now, add next)
     - New CrewAI agent `Company Enricher` (`pipeline/agents/enricher.py`) with tasks:
       - Resolve official website (Tavily), scrape About/Overview pages (ScrapeWebsiteTool), and extract bio + metadata.
       - Guardrails: exclude non-climate domains; respect robots; timeouts; JSON schema with nulls over guesses.
     - Runner: invoked by a small Python entry (`pipeline/enrich_company.py --slug <slug>`) or queued by a background worker; writes to `companies` via service key.
   - P3.5 Frontend/Backend wiring
     - [~] API `POST /api/companies/[slug]/enrich` (server-only): added stub endpoint returning 202 with simple in-memory rate limit and optional `x-admin-token` header. Queuing to be implemented.
     - [~] Client wiring: `CompanyBio` now POSTs to `/api/companies/[slug]/enrich`; button present (admin gating pending until auth is added).
   - P3.6 Testing
     - Jest: unit tests for `slugify`, `CompanyDetails` rendering, and list-to-detail navigation.
     - Integration: API route returns combined company + events; SWR polling transitions from `pending` to `ready` state (mock Supabase and enrichment responses).
     - E2E: navigate from dashboard to company page, verify metrics and source links.
   - P3.7 Security & UX
     - No service keys on client; all writes go through server-side routes or pipeline.
     - External links `rel="noopener noreferrer"`; safe HTML for bios (no HTML injection; plain text/markdown only).
     - Rate limit enrichment endpoints; add caching headers for `GET /api/companies/[slug]`.
     - Accessibility: keyboard navigation, visible focus, and ARIA labels.
 - Phase 4: Deployment & Documentation — Status: Not Started — 2025-08-08T03:40:39Z
   - Vercel deploy; enable scheduler; README with architecture diagram and setup instructions.


## 19) Acceptance Criteria (per phase)

- P0: `plan.md`, `log.md` checked in; Supabase SQL applied; env vars collected.
- P1: Pipeline runs locally, writes to Supabase; tests >= 80% coverage for core modules.
- P2: Scheduled job runs every 2 hours; error alerts visible in logs.
- P3: Frontend deployed; filters work; “Last Updated” displays correctly; E2E green.
- P4: README complete; one full scheduled cycle verified.

## 19.1) Confirmed Inputs & Decisions
Status: Completed — 2025-08-08T03:27:32Z

- Deployment: Vercel (frontend), Vercel Cron selected as primary scheduler.
- UI System: Shadcn UI.
- LLM: google-generativeai with model `gemini-2.0-flash`.
- Repository: https://github.com/Valbows/Climate-Funding-Intel
- Secrets received (not committed): Supabase URL/anon/service role, Tavily API key, Gemini API key. Stored via local env files only.

## 20) Next Steps (To enter Designer Mode)

- Confirm inputs in Section 17.
- Approve stack/version pins and directory structure.
- On approval, I’ll scaffold the repo, create code skeletons, configure CI, and implement the UI wireframe.

---

End of Architect Phase plan.
