"""Research task factory.
"""
from __future__ import annotations


def create_research_task(agent):
    from crewai import Task  # type: ignore

    return Task(
        description=(
            "Search the web for recent (since Jan 2025) funding news specifically for 'Energy and Grid' "
            "climate-tech startups. Focus on terms like: seed, Series A/B, venture capital, round, raised, "
            "investment. Use search operators (e.g., site:) to prioritize credible outlets such as: "
            "TechCrunch, Crunchbase News, VentureBeat, Bloomberg, Reuters, Canary Media, Utility Dive, PV Magazine, "
            "PR Newswire. Return only high-quality article URLs that clearly discuss funding events.\n\n"
            "TOOL USAGE:\n"
            "- You MUST use the available web search tool (e.g., Tavily Search) to find real, recent URLs.\n"
            "- Run at least 5 distinct queries (vary keywords like 'seed', 'Series A', 'raised', 'funding round', 'energy grid', 'power grid', 'transmission').\n"
            "- Prefer results from the credible sources listed above.\n"
            "- Do NOT hallucinate or fabricate URLs. If a source is paywalled, pick an alternative credible source.\n\n"
            "STRICT OUTPUT RULES:\n"
            "- Output only full https URLs, no titles or notes.\n"
            "- One URL per line. No numbering, bullets, or extra text.\n"
            "- Exclude PDFs, CSVs, sitemaps, SEC filings, podcasts, and social posts.\n"
            "- Avoid duplicates.\n"
            "- Return between 8 and 12 URLs when available. If fewer than 8 exist after thorough searching, return as many valid URLs as you found."
        ),
        expected_output=(
            "A raw list of 8-12 https URLs, each on a new line, with no additional text."
        ),
        agent=agent,
    )
