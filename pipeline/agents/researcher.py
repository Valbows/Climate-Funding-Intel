"""Researcher Agent factory.

Creates an agent focused on discovering recent climate-tech funding news
using `TavilySearchTool`.
"""
from __future__ import annotations

from typing import Any


def create_researcher(llm: Any):
    try:
        from crewai import Agent  # type: ignore
        from crewai_tools import TavilySearchTool  # type: ignore
    except Exception as e:  # pragma: no cover
        raise RuntimeError(
            "Missing dependencies. Install 'crewai' and 'crewai-tools' from pipeline/requirements.txt"
        ) from e

    tavily_tool = TavilySearchTool()

    return Agent(
        role="Expert Climate Tech Investment Researcher",
        goal=(
            "Find and report on the latest funding rounds in the Energy and Grid climate tech sector."
        ),
        backstory=(
            "Meticulous financial analyst tracking VC activity in energy and grid."
        ),
        verbose=True,
        allow_delegation=False,
        tools=[tavily_tool],
        llm=llm,
    )
