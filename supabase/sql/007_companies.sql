-- 007_companies.sql
-- Companies table to store minimal company profiles enriched by the pipeline.
-- Readable by public (anon/authenticated). Writes performed by service role.

BEGIN;

CREATE TABLE IF NOT EXISTS public.companies (
  slug text PRIMARY KEY,
  name text,
  website text,
  bio text,
  sources text[] DEFAULT '{}'::text[],
  last_enriched_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.companies IS 'Company profiles enriched by the pipeline (bio, website, sources).';
COMMENT ON COLUMN public.companies.slug IS 'URL-friendly unique identifier for the company.';
COMMENT ON COLUMN public.companies.sources IS 'List of source URLs consulted during enrichment.';

-- Enable RLS and allow read access for anon & authenticated roles.
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='companies' AND policyname='Allow read for anon'
  ) THEN
    CREATE POLICY "Allow read for anon" ON public.companies
      FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='companies' AND policyname='Allow read for authenticated'
  ) THEN
    CREATE POLICY "Allow read for authenticated" ON public.companies
      FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

-- Keep updated_at current on UPDATE
CREATE OR REPLACE FUNCTION public.set_companies_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='trg_companies_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_companies_set_updated_at
      BEFORE UPDATE ON public.companies
      FOR EACH ROW
      EXECUTE FUNCTION public.set_companies_updated_at();
  END IF;
END$$;

COMMIT;
