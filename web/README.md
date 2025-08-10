# CLIMATE TRACKER INTEL (Web)

Next.js + TypeScript + Tailwind (shadcn-style) dashboard matching the provided design.

## Run locally

```bash
# from repo root
cd web
npm install
npm run dev
```

Open http://localhost:3000

## Environment

This app can fetch live funding events from Supabase. Configure the following public env vars:

1) Copy the example file and fill values from your Supabase project (Settings → API):

```bash
cp .env.local.example .env.local
```

Set:
- `NEXT_PUBLIC_SUPABASE_URL` (e.g. https://YOUR-PROJECT.supabase.co)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon public key)

Notes:
- Components gate live fetching based on these env vars. If they are missing, some components render a disabled state. Tests explicitly enable fetching when needed.
- Only use the anon key in the browser; never expose the service role key.

## Testing

Run the test suite:

```bash
npm run test
# or CI mode
npm run test:ci
```

### E2E (Playwright)

Playwright is configured to auto-start `next dev` and run smoke tests:

```bash
# from web/
npm run e2e           # headless, all browsers
npm run e2e -- --project=chromium   # single browser
npm run e2e:ui       # Playwright UI mode
npm run e2e:report   # open last HTML report
```

Test infra:
- SWR cache is isolated per test via `SWRConfig` to avoid cross-test pollution.
- Recharts `ResponsiveContainer` is globally mocked in `jest.setup.ts` to avoid zero width/height warnings in jsdom.
- Pagination and filter flows are covered in `src/components/__tests__/funding-events-list.pagination.test.tsx`.

## Manual Enrichment API (dev/staging)

Endpoint (server-only): `POST /api/companies/[slug]/enrich`

- Returns `202 Accepted` to acknowledge the request.
- When `ENRICH_RUNNER_ENABLED=true`, the API spawns the local Python runner (`pipeline/enrich_company.py`) in the background and responds immediately with `{ mode: "local-runner" }`.
- When disabled, it returns a stub `{ mode: "stub" }` with no side effects.
- Rate limit: simple in-memory window (60s) per IP+slug; returns `429` with `Retry-After` when exceeded.
- Optional admin token: if `ENRICH_ADMIN_TOKEN` is set in `.env.local`, requests must include header `x-admin-token: $ENRICH_ADMIN_TOKEN`.

Local runner configuration (set in `web/.env.local`):
- `ENRICH_RUNNER_ENABLED=true`
- `ENRICH_RUNNER_PYTHON` (optional, default `python`)
- `ENRICH_RUNNER_CWD` (optional, default resolves to repo root one level above `web/`)

Requirements for the runner to succeed:
- `pipeline/.env` populated with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` (and any other pipeline vars)
- Python environment with pipeline deps installed (see `pipeline/README.md`)

Example:

```bash
curl -i -X POST \
  -H "x-admin-token: $ENRICH_ADMIN_TOKEN" \
  http://localhost:3000/api/companies/example-co/enrich
```

Client wiring: `CompanyBio` uses this endpoint for the "Fetch Bio" button and polls `GET /api/companies/[slug]` every 5s only while `bio_status === 'pending'`.
UI note: after requesting enrichment, a small toast indicates whether the request used the local runner or stub mode.

## CI (GitHub Actions)

If using GitHub Actions, add repository secrets so live-fetching tests can run against your Supabase project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Alternatively, configure your workflow to create a `.env.local` before running `npm ci`/tests using these secrets. Ensure only anon keys are used on the frontend.

## Deployment (Vercel)

Deploy the Next.js app to Vercel:

1) Project setup
- Create a new Vercel Project and import this GitHub repo.
- Framework preset: Next.js. Root directory: `web/`.
- Build & Install: uses `vercel.json` in `web/` (install `npm ci`, build `npm run build`).

2) Environment Variables (Recommended: Production + Preview)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Optional server-only: `ENRICH_ADMIN_TOKEN` (for protecting POST `/api/companies/[slug]/enrich`).
- Do NOT enable `ENRICH_RUNNER_ENABLED` in production (local runner is dev-only).

3) First deploy
- Push to `main` to trigger Vercel build, or deploy manually from Vercel UI.
- Post-deploy check: open `/companies/example-co` and verify page renders; the “Fetch Bio” button POSTs to the enrich API (stub in production unless you set `ENRICH_ADMIN_TOKEN`).

4) CI notes
- GitHub Actions workflow at `.github/workflows/ci.yml` runs:
  - `pipeline-pytest` (Python unit test for sanitize_bio).
  - `web-test` (Jest unit/integration).
  - `web-e2e-prod` (Playwright Chromium in prod mode via `npm run e2e:prod:chromium`).
  - Prod-mode E2E uses `E2E_USE_START=true` so Playwright starts `next start` rather than `next dev`.

## Notes
- Design approximates the provided layered CSS in a responsive way.
- Components are shadcn-style (Card, Badge) without the CLI; you can add the shadcn CLI later if desired.
- Charts: Recharts area chart with dual series and gradients.
- Fonts: Urbanist via next/font.
- Colors follow the dark theme from the spec (#111 background, #191919 surfaces, #272727 borders).
- Dev note: During development, avoid any in-app preview proxy for Next.js `next dev` — it may cause 404s for `/_next/static/*` assets. Use a direct browser tab (e.g., http://localhost:3000).
