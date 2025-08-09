# Pipeline: Company Enrichment (P3.4)

This directory contains the data pipeline used by Climate Funding Intel.

## Enrich a single company

Script: `pipeline/enrich_company.py`

Usage:

```bash
# from repo root (recommended)
python -m pipeline.enrich_company --slug example-co
```

Environment (copy `pipeline/.env` and fill values or export in shell):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` (Google AI Studio)
- `MODEL` (optional, default `gemini-2.0-flash`)
- `SUPABASE_COMPANIES_TABLE` (optional, default `companies`)

What it does:
- Builds a CrewAI LLM and a Company Enricher agent (Tavily search + website scraper)
- Finds the official website and scrapes About/Overview page(s)
- Produces a concise, safe bio (1–3 sentences)
- Upserts into Supabase `companies` table: `slug`, `website`, `bio`, `sources[]`, `last_enriched_at`, `updated_at`

Notes:
- Respects robots.txt via the scraper tool. If disallowed or uncertain, returns `null` fields.
- Output is sanitized (HTML stripped, length capped) before DB write.
- You can tune LLM behavior via `MODEL`, `LLM_TEMPERATURE`, `LLM_TIMEOUT`, etc.
