from __future__ import annotations
"""
Company enrichment runner (P3.4).

Usage:
  python -m pipeline.enrich_company --slug example-co

Environment (see pipeline/.env):
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- GEMINI_API_KEY (for CrewAI LLM)
- MODEL (optional, default gemini-2.0-flash)

This script:
- Builds a CrewAI LLM
- Creates the Company Enricher agent (Tavily + ScrapeWebsite)
- Runs a single Task to locate the official website and extract a short bio
- Parses JSON output and upserts into Supabase `companies` (bio, website, sources, last_enriched_at)
"""
import argparse
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

from pipeline.llm.gemini_client import build_llm
from pipeline.agents.enricher import create_enricher
from pipeline.utils.json_utils import extract_json
from pipeline.supabase_client import get_client


def setup_logging() -> None:
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, level, logging.INFO),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


def strip_html(text: str) -> str:
    # very basic HTML tag removal; keep as plain text
    text = re.sub(r"<\s*br\s*/?\s*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def sanitize_bio(bio: Optional[str]) -> Optional[str]:
    if not bio or not isinstance(bio, str):
        return None
    bio = strip_html(bio)
    # 1-3 sentences guideline: keep a sane cap
    if len(bio) > 800:
        bio = bio[:800].rsplit(" ", 1)[0].strip() + "…"
    return bio if bio else None


def upsert_company_profile(slug: str, bio: Optional[str], website: Optional[str], sources: Optional[List[str]]) -> Dict[str, Any]:
    client = get_client()
    table = os.getenv("SUPABASE_COMPANIES_TABLE", "companies").strip() or "companies"
    now_iso = datetime.now(timezone.utc).isoformat()

    record: Dict[str, Any] = {"slug": slug, "updated_at": now_iso}
    if website:
        record["website"] = website
    if bio:
        record["bio"] = bio
        record["last_enriched_at"] = now_iso
    if sources is not None:
        record["sources"] = sources

    try:
        resp = client.table(table).upsert(record, on_conflict="slug").execute()
        data = getattr(resp, "data", None)
        error = getattr(resp, "error", None)
        return {"data": data, "error": error}
    except Exception as e:  # pragma: no cover
        logging.exception("Supabase upsert failed: %s", e)
        return {"data": None, "error": str(e)}


def run_once(slug: str) -> Dict[str, Any]:
    from crewai import Crew, Task, Process  # type: ignore

    llm = build_llm()
    enricher = create_enricher(llm=llm)

    description = (
        "Identify the official website for the company with slug '{slug}'.\n"
        "Use web search, then scrape the company's About/Overview page(s) to extract a concise, factual bio.\n"
        "Focus on climate/energy relevance. Avoid speculation or promotional fluff. If unsure, return nulls.\n\n"
        "OUTPUT STRICTLY AS JSON matching this schema (and nothing else):\n"
        "{\n"
        "  \"slug\": \"{slug}\",\n"
        "  \"website_url\": string | null,\n"
        "  \"bio\": string | null,\n"
        "  \"sources\": string[]  // list of URLs consulted\n"
        "}\n"
        "Rules:\n- Prefer official website; if unavailable return website_url=null.\n"
        "- Bio must be 1-3 sentences, factual, and brand-safe.\n"
        "- sources must be fully-qualified https URLs, no duplicates.\n"
        "- Respect robots.txt; do not scrape disallowed paths.\n"
        "- If you cannot find credible info, leave fields null.\n"
    ).format(slug=slug)

    task = Task(
        description=description,
        expected_output="A single JSON object per schema, no prose.",
        agent=enricher,
    )

    crew = Crew(agents=[enricher], tasks=[task], process=Process.sequential)
    result = crew.kickoff()
    result_text = str(result)
    logging.info("Agent result received (%s chars)", len(result_text))
    logging.debug("Raw result preview:\n%s", result_text[:1000])

    try:
        payload = extract_json(result_text)
    except Exception as e:
        logging.warning("Failed to parse JSON from result: %s", e)
        payload = {}

    slug_out = payload.get("slug") if isinstance(payload, dict) else None
    website = payload.get("website_url") if isinstance(payload, dict) else None
    bio_raw = payload.get("bio") if isinstance(payload, dict) else None
    sources = payload.get("sources") if isinstance(payload, dict) else None

    if not isinstance(sources, list):
        sources = []

    bio = sanitize_bio(bio_raw if isinstance(bio_raw, str) else None)

    upsert_resp = upsert_company_profile(slug, bio, website, sources)
    logging.info("Upsert response: %s", upsert_resp)

    return {
        "slug": slug_out or slug,
        "website": website,
        "bio_len": len(bio) if bio else 0,
        "sources": len(sources),
        "db_error": upsert_resp.get("error"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich a single company profile by slug")
    parser.add_argument("--slug", required=True, help="Company slug, e.g., 'example-co'")
    args = parser.parse_args()

    env_path = os.path.join(os.path.dirname(__file__), ".env")
    load_dotenv(env_path, override=False)

    setup_logging()

    try:
        summary = run_once(args.slug)
        logging.info("Enrichment complete: %s", json.dumps(summary))
    except Exception as e:
        logging.exception("Enrichment failed: %s", e)
        raise


if __name__ == "__main__":
    main()
