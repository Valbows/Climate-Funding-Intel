"""Company Enricher Agent factory.

Creates an agent focused on discovering an official company website and
extracting a concise, safe bio from About/Overview pages.

Tools: TavilySearchTool, ScrapeWebsiteTool
"""
from __future__ import annotations

from typing import Any


def create_enricher(llm: Any):
    try:
        from crewai import Agent  # type: ignore
        from crewai_tools import TavilySearchTool, ScrapeWebsiteTool  # type: ignore
    except Exception as e:  # pragma: no cover
        raise RuntimeError(
            "Missing dependencies. Install from pipeline/requirements.txt"
        ) from e

    tavily = TavilySearchTool()
    scraper = ScrapeWebsiteTool()

    return Agent(
        role="Company Profile Enricher",
        goal=(
            "Identify the company's official website and extract a concise, factual,\n"
            "brand-safe bio (1-3 sentences) from About/Overview pages."
        ),
        backstory=(
            "You enrich company profiles for a climate funding intelligence platform.\n"
            "You prioritize official sources and avoid speculation."
        ),
        verbose=True,
        allow_delegation=False,
        tools=[tavily, scraper],
        llm=llm,
    )
