from __future__ import annotations

import asyncio
import re
from typing import Any

import httpx

from ..config import Settings
from .models import Citation, RetrievalDiagnostics, RetrievalResult

try:
    from azure.identity.aio import DefaultAzureCredential
except Exception:  # pragma: no cover - optional dependency
    DefaultAzureCredential = None  # type: ignore[assignment]


class AzureSearchHybridRetriever:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def retrieve(
        self,
        *,
        query: str,
        inherited_errors: list[str] | None = None,
        filter_expression: str | None = None,
        index_name: str | None = None,
        vector_fields_override: list[str] | None = None,
        query_vector: list[float] | None = None,
        provider_label: str = "azure_search_hybrid",
        source_label: str = "azure_search_hybrid",
    ) -> RetrievalResult:
        inherited_errors = inherited_errors or []
        if not self._settings.azure_search_fallback_enabled:
            return RetrievalResult(
                provider=provider_label,
                citations=[],
                evidence=[],
                diagnostics=RetrievalDiagnostics(
                    provider=provider_label,
                    used_fallback=bool(inherited_errors),
                    errors=[*inherited_errors, "AZURE_SEARCH_FALLBACK_ENABLED is false."],
                ),
            )

        endpoint = (self._settings.azure_search_service_endpoint or "").strip()
        resolved_index_name = (index_name or self._settings.azure_search_index_name or "").strip()
        if not endpoint or not resolved_index_name:
            return RetrievalResult(
                provider=provider_label,
                citations=[],
                evidence=[],
                diagnostics=RetrievalDiagnostics(
                    provider=provider_label,
                    used_fallback=bool(inherited_errors),
                    errors=[
                        *inherited_errors,
                        "Azure Search hybrid fallback is not configured. "
                        "Set AZURE_SEARCH_SERVICE_ENDPOINT and AZURE_SEARCH_INDEX_NAME.",
                    ],
                ),
            )

        url = f"{endpoint.rstrip('/')}/indexes/{resolved_index_name}/docs/search"
        params = {"api-version": self._settings.azure_search_api_version}

        headers = {"content-type": "application/json"}
        auth_error = await self._apply_auth(headers)
        if auth_error:
            return RetrievalResult(
                provider=provider_label,
                citations=[],
                evidence=[],
                diagnostics=RetrievalDiagnostics(
                    provider=provider_label,
                    used_fallback=bool(inherited_errors),
                    errors=[*inherited_errors, auth_error],
                ),
            )

        payload = self._build_search_payload(
            query=query,
            filter_expression=filter_expression,
            vector_fields_override=vector_fields_override,
            query_vector=query_vector,
        )
        raw_data: dict[str, Any] | None = None
        errors = [*inherited_errors]

        try:
            timeout = self._settings.azure_search_timeout_seconds
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, params=params, headers=headers, json=payload)
                if response.status_code >= 400 and "vectorQueries" in payload:
                    errors.append(
                        "Vectorized hybrid query failed; retrying with semantic lexical query only."
                    )
                    fallback_payload = dict(payload)
                    fallback_payload.pop("vectorQueries", None)
                    response = await client.post(
                        url,
                        params=params,
                        headers=headers,
                        json=fallback_payload,
                    )
                if response.status_code >= 400 and payload.get("queryType") == "semantic":
                    errors.append(
                        "Semantic query failed; retrying with lexical query."
                    )
                    lexical_payload = dict(payload)
                    lexical_payload.pop("queryType", None)
                    lexical_payload.pop("captions", None)
                    lexical_payload.pop("answers", None)
                    lexical_payload.pop("semanticConfiguration", None)
                    lexical_payload.pop("vectorQueries", None)
                    response = await client.post(
                        url,
                        params=params,
                        headers=headers,
                        json=lexical_payload,
                    )

                response.raise_for_status()
                raw_data = response.json() if response.content else {}
                if payload.get("queryType") == "semantic" and not self._has_results(raw_data):
                    errors.append("Semantic query returned no matches; retrying with lexical query.")
                    lexical_payload = dict(payload)
                    lexical_payload.pop("queryType", None)
                    lexical_payload.pop("captions", None)
                    lexical_payload.pop("answers", None)
                    lexical_payload.pop("semanticConfiguration", None)
                    lexical_payload.pop("vectorQueries", None)
                    response = await client.post(
                        url,
                        params=params,
                        headers=headers,
                        json=lexical_payload,
                    )
                    response.raise_for_status()
                    raw_data = response.json() if response.content else {}
        except BaseException as exc:
            if isinstance(exc, asyncio.CancelledError):
                task = asyncio.current_task()
                if task is not None:
                    try:
                        task.uncancel()
                    except Exception:
                        pass
            elif isinstance(exc, (KeyboardInterrupt, SystemExit)):
                raise
            return RetrievalResult(
                provider=provider_label,
                citations=[],
                evidence=[],
                diagnostics=RetrievalDiagnostics(
                    provider=provider_label,
                    used_fallback=bool(inherited_errors),
                    errors=[*errors, f"Azure Search hybrid retrieval failed: {exc}"],
                ),
            )

        citations = self._extract_citations(raw_data or {}, source_label=source_label)
        evidence = [c.snippet for c in citations if c.snippet][:6]
        if not citations:
            errors.append("Azure Search returned no parseable citations.")

        return RetrievalResult(
            provider=provider_label,
            citations=citations,
            evidence=evidence,
            diagnostics=RetrievalDiagnostics(
                provider=provider_label,
                used_fallback=bool(inherited_errors),
                errors=errors,
                raw=raw_data,
            ),
        )

    def _build_search_payload(
        self,
        *,
        query: str,
        filter_expression: str | None = None,
        vector_fields_override: list[str] | None = None,
        query_vector: list[float] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "search": query,
            "top": self._settings.azure_search_top_k,
            "queryType": "semantic",
            "captions": "extractive",
            "answers": "extractive|count-3",
        }

        if filter_expression:
            payload["filter"] = filter_expression

        if self._settings.azure_search_semantic_configuration:
            payload["semanticConfiguration"] = self._settings.azure_search_semantic_configuration

        if self._settings.azure_search_select_fields:
            payload["select"] = ",".join(self._settings.azure_search_select_fields)

        if vector_fields_override is None:
            vector_fields = self._settings.azure_search_vector_fields
        else:
            vector_fields = [field.strip() for field in vector_fields_override if field and field.strip()]
        if vector_fields:
            vector_query: dict[str, Any]
            if query_vector:
                vector_query = {
                    "kind": "vector",
                    "vector": query_vector,
                    "fields": ",".join(vector_fields),
                    "k": self._settings.azure_search_vector_k,
                }
            else:
                vector_query = {
                    "kind": "text",
                    "text": query,
                    "fields": ",".join(vector_fields),
                    "k": self._settings.azure_search_vector_k,
                }
            payload["vectorQueries"] = [vector_query]

        return payload

    async def _apply_auth(self, headers: dict[str, str]) -> str | None:
        if self._settings.azure_search_use_managed_identity:
            if DefaultAzureCredential is None:
                return (
                    "AZURE_SEARCH_USE_MANAGED_IDENTITY=true but azure-identity is unavailable. "
                    "Install azure-identity in this runtime."
                )
            credential = DefaultAzureCredential()
            try:
                token = await credential.get_token("https://search.azure.com/.default")
            except Exception as exc:
                return f"Managed identity token request failed for Azure Search: {exc}"
            finally:
                try:
                    await credential.close()
                except Exception:
                    pass
            headers["Authorization"] = f"Bearer {token.token}"
            return None

        if self._settings.azure_search_api_key:
            headers["api-key"] = self._settings.azure_search_api_key.strip()
            return None

        return (
            "Azure Search credentials are missing. Provide AZURE_SEARCH_API_KEY "
            "or set AZURE_SEARCH_USE_MANAGED_IDENTITY=true."
        )

    def _extract_citations(self, payload: dict[str, Any], *, source_label: str) -> list[Citation]:
        values = payload.get("value")
        if not isinstance(values, list):
            return []

        citations: list[Citation] = []
        seen: set[str] = set()

        for doc in values:
            if not isinstance(doc, dict):
                continue

            title = self._pick_field(doc, self._settings.azure_search_title_fields)
            url = self._pick_field(doc, self._settings.azure_search_url_fields)
            snippet = self._extract_snippet(doc)
            published_date = self._extract_published_date(doc)
            score = self._extract_score(doc)

            if not title and not url and not snippet:
                continue

            clean_title = title or "Untitled source"
            clean_url = url if self._is_http_url(url) else None
            clean_snippet = self._normalize_snippet(snippet)

            dedupe_key = f"{clean_title.lower()}|{(clean_url or '').lower()}|{clean_snippet.lower()}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)

            citations.append(
                Citation(
                    title=clean_title,
                    url=clean_url,
                    snippet=clean_snippet or None,
                    published_date=published_date,
                    source=source_label,
                    score=score,
                )
            )

            if len(citations) >= self._settings.azure_search_top_k:
                break

        return citations

    @staticmethod
    def _has_results(payload: dict[str, Any] | None) -> bool:
        if not isinstance(payload, dict):
            return False
        values = payload.get("value")
        return isinstance(values, list) and len(values) > 0

    def _pick_field(self, doc: dict[str, Any], keys: list[str]) -> str:
        lowered = {str(k).lower(): k for k in doc.keys()}
        for key in keys:
            origin = key if key in doc else lowered.get(key.lower())
            if origin is None:
                continue
            value = doc.get(origin)
            if isinstance(value, str) and value.strip():
                return value.strip()

        for value in doc.values():
            if isinstance(value, str) and value.strip() and len(value) <= 140:
                return value.strip()

        return ""

    def _extract_snippet(self, doc: dict[str, Any]) -> str:
        captions = doc.get("@search.captions")
        if isinstance(captions, list):
            for caption in captions:
                if isinstance(caption, dict):
                    text = caption.get("text")
                    if isinstance(text, str) and text.strip():
                        return text.strip()

        for key in self._settings.azure_search_content_fields:
            value = doc.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

        lowered = {str(k).lower(): k for k in doc.keys()}
        for key in self._settings.azure_search_content_fields:
            origin = lowered.get(key.lower())
            if origin is None:
                continue
            value = doc.get(origin)
            if isinstance(value, str) and value.strip():
                return value.strip()

        for value in doc.values():
            if isinstance(value, str) and value.strip() and len(value) > 160:
                return value.strip()

        return ""

    def _extract_published_date(self, doc: dict[str, Any]) -> str | None:
        keys = [
            "published_date",
            "publish_date",
            "date",
            "last_updated",
            "metadata_storage_last_modified",
        ]
        lowered = {str(k).lower(): k for k in doc.keys()}
        for key in keys:
            origin = key if key in doc else lowered.get(key.lower())
            if origin is None:
                continue
            value = doc.get(origin)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    def _extract_score(self, doc: dict[str, Any]) -> float | None:
        for key in ("@search.rerankerScore", "@search.score"):
            value = doc.get(key)
            if isinstance(value, (int, float)):
                return float(value)
        return None

    def _normalize_snippet(self, value: str) -> str:
        clean = re.sub(r"\s+", " ", (value or "")).strip()
        if len(clean) <= 360:
            return clean
        return f"{clean[:359]}..."

    def _is_http_url(self, value: str) -> bool:
        return isinstance(value, str) and bool(re.match(r"^https?://", value.strip(), flags=re.IGNORECASE))
