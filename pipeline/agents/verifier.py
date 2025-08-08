"""Verifier/Extractor Agent factory.

Uses `ScrapeWebsiteTool` and Gemini LLM to extract structured funding data
from article URLs.
"""
from __future__ import annotations

from typing import Any


def create_verifier(llm: Any):
    try:
        from crewai import Agent  # type: ignore
        from crewai_tools import ScrapeWebsiteTool, TavilySearchTool  # type: ignore
    except Exception as e:  # pragma: no cover
        raise RuntimeError(
            "Missing dependencies. Install 'crewai' and 'crewai-tools' from pipeline/requirements.txt"
        ) from e

    scrape_tool = ScrapeWebsiteTool()
    tavily_tool = TavilySearchTool()

    return Agent(
        role="Data Verification and Structuring Specialist",
        goal=(
            "Verify funding details from URLs and return database-ready JSON."
        ),
        backstory=(
            "Detail-oriented data analyst turning unstructured text into structured records."
        ),
        verbose=True,
        allow_delegation=False,
        tools=[scrape_tool, tavily_tool],
        llm=llm,
    )
