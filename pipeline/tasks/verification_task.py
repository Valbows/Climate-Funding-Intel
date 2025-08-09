"""Verification/Extraction task factory.
"""
from __future__ import annotations

from typing import Any


def create_verification_task(agent: Any, research_task: Any):
    from crewai import Task  # type: ignore

    return Task(
        description=(
            "For each URL discovered by the research task, extract: startup_name, geography, "
            "funding_stage, amount_raised_usd, lead_investor, funding_date (YYYY-MM-DD), "
            "sub_sector, source_url. If a non-required field is not found, set it to null.\n\n"
            "TOOL USAGE:\n"
            "- For each URL, you MUST first call the website scraping tool to retrieve article content.\n"
            "- If any fields remain unknown after scraping, you MAY use the web search tool to cross-check and fill missing details from credible sources.\n"
            "- Do NOT hallucinate values. Prefer leaving a field null to making up data.\n\n"
            "INCLUSION RULES (VERY IMPORTANT):\n"
            "- ONLY include climate-tech funding events specifically in the Energy/Grid domain (e.g., energy storage, batteries, EV charging, grid modernization, renewables, transmission, smart metering, hydrogen, CCUS).\n"
            "- EXCLUDE non-climate sectors such as fintech, stock trading/brokerage, payments, crypto, and neobanks (e.g., Robinhood, Coinbase).\n"
            "- Only include an event if BOTH conditions are met: (1) startup_name is present and non-empty, and (2) source_url is a valid https URL to the article.\n"
            "- If startup_name is missing/empty OR source_url is missing/invalid, OMIT that event entirely (do not output partial records).\n"
            "- Normalization: amount_raised_usd must be an integer number of USD (extract digits; no symbols), or null. funding_date must be YYYY-MM-DD or null. Trim whitespace from strings.\n\n"
            "CRITICAL OUTPUT RULES:\n"
            "- Respond with STRICT JSON only, double-quoted keys/strings.\n"
            "- Do NOT use code fences. Output ONLY a JSON object.\n"
            "- Do NOT include any prose or explanation before or after the JSON.\n"
            "- If no valid events can be extracted, return {\"events\": []}."
        ),
        expected_output=(
            "A JSON object with this exact shape: {\n"
            "  \"events\": [\n"
            "    {\n"
            "      \"startup_name\": string,  // REQUIRED (omit event if missing)\n"
            "      \"geography\": string | null,\n"
            "      \"funding_stage\": string | null,\n"
            "      \"amount_raised_usd\": integer | null,  // digits only, USD\n"
            "      \"lead_investor\": string | null,\n"
            "      \"funding_date\": \"YYYY-MM-DD\" | null,  // normalized date\n"
            "      \"sub_sector\": string | null,\n"
            "      \"source_url\": string  // REQUIRED, must start with https\n"
            "    }\n"
            "  ]\n"
            "}"
        ),
        agent=agent,
        context=[research_task],
    )
