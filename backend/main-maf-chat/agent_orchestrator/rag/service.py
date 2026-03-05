from __future__ import annotations

import asyncio
from typing import Any

from ..config import Settings
from .azure_search_hybrid import AzureSearchHybridRetriever
from .azure_search_mcp import AzureSearchMCPRetriever
from .models import Citation, RetrievalDiagnostics, RetrievalResult


class AzureRAGService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._mcp = AzureSearchMCPRetriever(settings)
        self._hybrid = AzureSearchHybridRetriever(settings)

    async def retrieve(self, *, query: str) -> RetrievalResult:
        errors: list[str] = []

        if self._settings.azure_search_mcp_enabled:
            try:
                # Isolate MCP cancellation scopes from the parent request task.
                mcp_result = await asyncio.create_task(self._mcp.retrieve(query=query))
            except BaseException as exc:
                if isinstance(exc, (KeyboardInterrupt, SystemExit)):
                    raise
                errors.append(f"Azure Search MCP retrieval failed unexpectedly: {exc}")
            else:
                if mcp_result.has_evidence:
                    return mcp_result
                errors.extend(mcp_result.diagnostics.errors)

        if self._settings.azure_search_fallback_enabled:
            try:
                hybrid_result = await asyncio.create_task(
                    self._hybrid.retrieve(query=query, inherited_errors=errors)
                )
            except BaseException as exc:
                if isinstance(exc, (KeyboardInterrupt, SystemExit)):
                    raise
                errors.append(f"Azure Search hybrid retrieval failed unexpectedly: {exc}")
            else:
                if hybrid_result.has_evidence:
                    hybrid_result.diagnostics.used_fallback = bool(errors)
                    return hybrid_result
                errors.extend(hybrid_result.diagnostics.errors)

        return RetrievalResult(
            provider="none",
            citations=[],
            evidence=[],
            diagnostics=RetrievalDiagnostics(
                provider="none",
                used_fallback=bool(errors),
                errors=errors or ["No Azure RAG provider produced retrieval evidence."],
            ),
        )

    def build_prompt_grounding(self, *, retrieval: RetrievalResult, max_items: int = 6) -> dict[str, Any]:
        citations = retrieval.citations[:max_items]
        evidence = retrieval.evidence[:max_items]
        records: list[dict[str, Any]] = []

        for citation in citations:
            records.append(
                {
                    "title": citation.title,
                    "url": citation.url,
                    "snippet": citation.snippet,
                    "published_date": citation.published_date,
                    "score": citation.score,
                    "source": citation.source,
                }
            )

        if not records and evidence:
            for idx, snippet in enumerate(evidence, start=1):
                records.append(
                    {
                        "title": f"Retrieved source {idx}",
                        "url": None,
                        "snippet": snippet,
                        "published_date": None,
                        "score": None,
                        "source": retrieval.provider,
                    }
                )

        return {
            "provider": retrieval.provider,
            "used_fallback": retrieval.diagnostics.used_fallback,
            "sources": records,
            "errors": retrieval.diagnostics.errors,
        }


def citations_to_dicts(citations: list[Citation]) -> list[dict[str, Any]]:
    return [citation.model_dump(mode="json", exclude_none=True) for citation in citations]
