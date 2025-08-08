# NRG Data Dashboard (Web)

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

Test infra:
- SWR cache is isolated per test via `SWRConfig` to avoid cross-test pollution.
- Recharts `ResponsiveContainer` is globally mocked in `jest.setup.ts` to avoid zero width/height warnings in jsdom.
- Pagination and filter flows are covered in `src/components/__tests__/funding-events-list.pagination.test.tsx`.

## CI (GitHub Actions)

If using GitHub Actions, add repository secrets so live-fetching tests can run against your Supabase project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Alternatively, configure your workflow to create a `.env.local` before running `npm ci`/tests using these secrets. Ensure only anon keys are used on the frontend.

## Notes
- Design approximates the provided layered CSS in a responsive way.
- Components are shadcn-style (Card, Badge) without the CLI; you can add the shadcn CLI later if desired.
- Charts: Recharts area chart with dual series and gradients.
- Fonts: Urbanist via next/font.
- Colors follow the dark theme from the spec (#111 background, #191919 surfaces, #272727 borders).
