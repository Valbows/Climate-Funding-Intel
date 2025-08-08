from __future__ import annotations

import os

from pipeline.llm import gemini_client as gc


def test_provider_model_prefix_plain():
    assert gc._provider_model("gemini-2.0-flash") == "gemini/gemini-2.0-flash"


def test_provider_model_prefix_passthrough():
    assert gc._provider_model("gemini/gemini-1.5-pro-latest") == "gemini/gemini-1.5-pro-latest"


def test_build_llm_uses_env_model(monkeypatch):
    # Monkeypatch the LLM class to capture init args without requiring CrewAI behavior
    captured = {}

    class StubLLM:  # noqa: N801 - mimic external class name
        def __init__(self, model, temperature, timeout, max_tokens, seed):  # type: ignore[no-untyped-def]
            captured.update(
                dict(
                    model=model,
                    temperature=temperature,
                    timeout=timeout,
                    max_tokens=max_tokens,
                    seed=seed,
                )
            )

    monkeypatch.setattr(gc, "LLM", StubLLM)
    monkeypatch.setenv("MODEL", "gemini-2.0-flash")
    monkeypatch.setenv("LLM_TEMPERATURE", "0.2")
    monkeypatch.setenv("LLM_TIMEOUT", "123")
    monkeypatch.setenv("LLM_MAX_TOKENS", "5678")
    monkeypatch.setenv("LLM_SEED", "7")

    _ = gc.build_llm()

    assert captured["model"] == "gemini/gemini-2.0-flash"
    assert captured["temperature"] == 0.2
    assert captured["timeout"] == 123
    assert captured["max_tokens"] == 5678
    assert captured["seed"] == 7
