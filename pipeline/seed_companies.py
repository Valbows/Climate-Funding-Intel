from __future__ import annotations
"""
Seed companies from list articles and similar sources.

- Scrapes provided URLs (startup lists, reports, blog posts) and extracts company names
  and, when available, official websites.
- Upserts into Supabase `companies` table with `slug`, optional `website`, `updated_at`.
- Can be run in Docker (see pipeline/Dockerfile) or locally in a compatible Python env.

Usage:
  python -m pipeline.seed_companies --url <URL> [--url <URL> ...]
  # Heuristic (non-LLM) mode to avoid LLM quota
  python -m pipeline.seed_companies --heuristic --url <URL> [...]

Env (copy `pipeline/.env`):
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- GEMINI_API_KEY
- Optional: SUPABASE_COMPANIES_TABLE (default: companies)

Notes:
- Uses CrewAI with `ScrapeWebsiteTool` and optional `TavilySearchTool` to find official sites
  if missing on the list page.
- Respects robots.txt via the scraping tool; if blocked, the entry may be skipped.
- Output de-duplicates by normalized slug.
"""
import argparse
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

from dotenv import load_dotenv

from pipeline.supabase_client import get_client
from pipeline.llm.gemini_client import build_llm
from pipeline.utils.json_utils import extract_json

# Heuristic mode deps are optional and only used when --heuristic is passed
try:
    import requests  # type: ignore
    from bs4 import BeautifulSoup  # type: ignore
except Exception:  # pragma: no cover
    requests = None  # type: ignore
    BeautifulSoup = None  # type: ignore


LOG = logging.getLogger(__name__)


def setup_logging() -> None:
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(level=getattr(logging, level, logging.INFO), format="%(levelname)s %(message)s")


def slugify(name: str) -> str:
    s = (name or "").strip().lower()
    # replace non-alphanumeric with hyphens
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    s = re.sub(r"-+", "-", s)
    return s[:80]


def upsert_company(slug: str, website: Optional[str], name: Optional[str] = None) -> Dict[str, Any]:
    client = get_client()
    table = os.getenv("SUPABASE_COMPANIES_TABLE", "companies").strip() or "companies"
    now_iso = datetime.now(timezone.utc).isoformat()

    record: Dict[str, Any] = {"slug": slug, "updated_at": now_iso}
    if website:
        record["website"] = website
    if name:
        record["name"] = name

    try:
        resp = client.table(table).upsert(record, on_conflict="slug").execute()
        data = getattr(resp, "data", None)
        error = getattr(resp, "error", None)
        return {"data": data, "error": error}
    except Exception as e:  # pragma: no cover
        LOG.exception("Supabase upsert failed: %s", e)
        return {"data": None, "error": str(e)}


def _heuristic_fetch(url: str, timeout: int = 20) -> Optional[str]:
    if requests is None:
        LOG.error("requests not installed; cannot run heuristic mode")
        return None
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0 Safari/537.36"
        )
    }
    try:
        resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        if resp.status_code >= 400:
            LOG.warning("Fetch %s failed with status %s", url, resp.status_code)
            return None
        ct = resp.headers.get("content-type", "").lower()
        if "text/html" not in ct:
            LOG.warning("Skip non-HTML content at %s: %s", url, ct)
            return None
        return resp.text
    except Exception as e:
        LOG.warning("Fetch error for %s: %s", url, e)
        return None


def _domain(host: str) -> str:
    return host.lower()


_BAN_DOMAINS = (
    "twitter.com",
    "x.com",
    "linkedin.com",
    "facebook.com",
    "instagram.com",
    "youtube.com",
    "medium.com",
    "substack.com",
    "github.com",
    "crunchbase.com",
    "angel.co",
    "dealroom.co",
)


def _clean_name(text: str) -> str:
    t = (text or "").strip()
    # Remove common non-name phrases
    bad = {
        "read more",
        "learn more",
        "website",
        "official website",
        "homepage",
        "visit site",
        "click here",
    }
    tl = t.lower()
    if tl in bad:
        return ""
    # Strip excessive punctuation
    t = re.sub(r"\s+", " ", t)
    t = re.sub(r"[\u2010-\u2015]", "-", t)  # dash variants
    t = re.sub(r"[^A-Za-z0-9 &\-]", "", t)
    return t.strip().strip("- ")


def _sld(host: str) -> str:
    parts = host.split(".")
    if len(parts) >= 2:
        return parts[-2]
    return host


def heuristic_extract(html: str, base_url: str, max_items: int = 300) -> List[Dict[str, Optional[str]]]:
    if BeautifulSoup is None:
        LOG.error("beautifulsoup4 not installed; cannot run heuristic mode")
        return []
    soup = BeautifulSoup(html, "html.parser")
    base_host = _domain(urlparse(base_url).netloc)
    seen: set[str] = set()
    results: List[Dict[str, Optional[str]]] = []

    def add(name: str, website: Optional[str]):
        nonlocal results
        name_clean = _clean_name(name)
        if not name_clean or len(name_clean) < 2 or len(name_clean) > 80:
            return
        slug = slugify(name_clean)
        if not slug or slug in seen:
            return
        seen.add(slug)
        if website and not website.lower().startswith("http"):
            website = f"https://{website}"
        results.append({"name": name_clean, "website": website})

    # Pass 1: external anchors likely pointing to official sites
    for a in soup.find_all("a", href=True):
        if len(results) >= max_items:
            break
        href = a.get("href")
        if not href or any(href.startswith(p) for p in ("#", "mailto:", "tel:", "javascript:")):
            continue
        abs_url = urljoin(base_url, href)
        p = urlparse(abs_url)
        if p.scheme not in ("http", "https") or not p.netloc:
            continue
        host = _domain(p.netloc)
        if host == base_host or any(b in host for b in _BAN_DOMAINS):
            continue
        text = a.get_text(strip=True) or a.get("title", "")
        name = _clean_name(text) or _sld(host)
        add(name, abs_url)

    # Pass 2: headings/list items with a qualifying external link nearby
    for node in soup.select("h1, h2, h3, h4, li, dt"):  # dt for definition lists
        if len(results) >= max_items:
            break
        name = _clean_name(node.get_text(" ", strip=True))
        if not name:
            continue
        # Try to find an anchor within the same container
        link = node.find("a", href=True)
        if not link:
            continue
        abs_url = urljoin(base_url, link.get("href"))
        p = urlparse(abs_url)
        host = _domain(p.netloc)
        if p.scheme in ("http", "https") and host and host != base_host and not any(b in host for b in _BAN_DOMAINS):
            add(name, abs_url)

    return results


def run_heuristic(urls: List[str]) -> Dict[str, Any]:
    all_companies: Dict[str, Dict[str, Optional[str]]] = {}
    total_extracted = 0
    for u in urls:
        html = _heuristic_fetch(u)
        if not html:
            continue
        items = heuristic_extract(html, u)
        total_extracted += len(items)
        for c in items:
            name = c.get("name") if isinstance(c, dict) else None
            if not isinstance(name, str):
                continue
            slug = slugify(name)
            if not slug:
                continue
            website = c.get("website") if isinstance(c, dict) else None
            existing = all_companies.get(slug)
            if existing is None or (not existing.get("website") and website):
                all_companies[slug] = {"name": name, "website": website}

    upserts = 0
    for slug, entry in all_companies.items():
        site = entry.get("website")
        resp = upsert_company(slug, site if isinstance(site, str) else None, entry.get("name") if isinstance(entry.get("name"), str) else None)
        if not resp.get("error"):
            upserts += 1
        else:
            LOG.warning("Upsert error for %s: %s", slug, resp.get("error"))

    return {"input_urls": len(urls), "extracted": total_extracted, "unique": len(all_companies), "upserts": upserts}


def create_extractor(llm: Any):
    try:
        from crewai import Agent  # type: ignore
        from crewai_tools import ScrapeWebsiteTool, TavilySearchTool  # type: ignore
    except Exception as e:  # pragma: no cover
        raise RuntimeError(
            "Missing dependencies. Install from pipeline/requirements.txt"
        ) from e

    scraper = ScrapeWebsiteTool()
    tavily = TavilySearchTool()

    return Agent(
        role="Climate Tech Company List Extractor",
        goal=(
            "From list pages and reports, identify climate tech startups and their official websites."
        ),
        backstory=(
            "You read startup lists and articles, extract company names and find official sites. "
            "You avoid including investors, universities, or non-startup entities."
        ),
        verbose=True,
        allow_delegation=False,
        tools=[scraper, tavily],
        llm=llm,
    )


def create_task(agent: Any, urls: List[str]):
    from crewai import Task  # type: ignore

    urls_text = "\n".join(urls)
    return Task(
        description=(
            "You are given a set of URLs that may contain lists of climate tech startups or mentions of them.\n"
            "For EACH URL, first use the website scraping tool to retrieve the content.\n"
            "From the content, extract a clean, de-duplicated list of startup companies.\n"
            "When the list page links directly to company websites, capture that link.\n"
            "If a website is not provided, use web search to find the official site. Prefer the company's own domain.\n"
            "Exclude duplicates, VCs, accelerators, universities, and non-startup entities.\n\n"
            "SOURCE URLS (one per line):\n"
            f"{urls_text}\n\n"
            "OUTPUT STRICTLY AS JSON (and nothing else) in this schema:\n"
            "{\n"
            "  \"companies\": [\n"
            "    { \"name\": string, \"website\": string | null }\n"
            "  ]\n"
            "}\n\n"
            "Rules:\n"
            "- Company names must be precise, as seen on the page.\n"
            "- If the official website cannot be found confidently, set website to null.\n"
            "- Only include entities that are clearly startups/companies, not general topics.\n"
        ),
        expected_output=(
            "A single JSON object with a 'companies' array, where each element has 'name' and 'website|null'."
        ),
        agent=agent,
    )


def kickoff_with_retry(crew) -> str:
    import time
    import random

    max_retries = int(os.getenv("LLM_MAX_RETRIES", "3"))
    base_delay = int(os.getenv("LLM_RETRY_BASE_DELAY", "30"))

    last_err: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            res = crew.kickoff()
            return "" if res is None else str(res)
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt >= max_retries:
                break
            wait_s = int(base_delay * (2 ** attempt) * random.uniform(0.5, 1.5))
            LOG.warning("Retrying list extraction (attempt %d/%d) in %ss: %s", attempt + 1, max_retries, wait_s, e)
            time.sleep(wait_s)
    assert last_err is not None
    raise last_err


def run_once(urls: List[str]) -> Dict[str, Any]:
    from crewai import Crew, Process  # type: ignore

    llm = build_llm()
    extractor = create_extractor(llm=llm)
    task = create_task(agent=extractor, urls=urls)

    crew = Crew(
        agents=[extractor],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )

    raw = kickoff_with_retry(crew)
    payload = extract_json(raw)
    companies = payload.get("companies") if isinstance(payload, dict) else None
    if not isinstance(companies, list):
        companies = []

    seen: set[str] = set()
    upserts = 0
    for c in companies:
        name = (c or {}).get("name")
        website = (c or {}).get("website")
        if not isinstance(name, str) or not name.strip():
            continue
        slug = slugify(name)
        if not slug or slug in seen:
            continue
        seen.add(slug)
        site = str(website).strip() if isinstance(website, str) and website else None
        if site and not site.lower().startswith("http"):
            site = f"https://{site}"
        resp = upsert_company(slug, site, name if isinstance(name, str) else None)
        if not resp.get("error"):
            upserts += 1
        else:
            LOG.warning("Upsert error for %s: %s", slug, resp.get("error"))

    return {"input_urls": len(urls), "extracted": len(companies), "upserts": upserts}


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed companies from list pages")
    parser.add_argument("--url", action="append", default=[], help="Source URL (repeatable)")
    parser.add_argument("--heuristic", action="store_true", help="Use heuristic scraping (no LLM)")
    args = parser.parse_args()

    # Load env from pipeline/.env if present
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    load_dotenv(env_path, override=False)

    setup_logging()

    urls = [u for u in args.url if isinstance(u, str) and u.strip()]
    if not urls:
        raise SystemExit("No --url provided")

    try:
        if args.heuristic:
            summary = run_heuristic(urls)
        else:
            summary = run_once(urls)
        LOG.info("Seeding complete: %s", json.dumps(summary, ensure_ascii=False))
    except Exception as e:
        LOG.exception("Seeding failed: %s", e)
        raise


if __name__ == "__main__":
    main()
