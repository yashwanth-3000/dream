from __future__ import annotations

import re
from typing import Any

import httpx

from ..config import Settings
from .azure_openai_embeddings import AzureOpenAIEmbeddingClient
from .azure_search_hybrid import AzureSearchHybridRetriever
from .models import Citation, RetrievalDiagnostics, RetrievalResult

try:
    from azure.identity.aio import DefaultAzureCredential
except Exception:  # pragma: no cover - optional dependency
    DefaultAzureCredential = None  # type: ignore[assignment]


class AzureStudyRAGService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._hybrid = AzureSearchHybridRetriever(settings)
        self._embeddings = AzureOpenAIEmbeddingClient(settings)

    async def retrieve(self, *, query: str, session_id: str | None) -> RetrievalResult:
        if not self._settings.azure_search_study_enabled:
            return RetrievalResult(
                provider="azure_search_study",
                citations=[],
                evidence=[],
                diagnostics=RetrievalDiagnostics(
                    provider="azure_search_study",
                    errors=["AZURE_SEARCH_STUDY_ENABLED is false."],
                ),
            )

        normalized_session_id = (session_id or "").strip()
        if not normalized_session_id:
            return RetrievalResult(
                provider="azure_search_study",
                citations=[],
                evidence=[],
                diagnostics=RetrievalDiagnostics(
                    provider="azure_search_study",
                    errors=["study_session_id is required in study mode."],
                ),
            )

        index_name = self._settings.azure_search_study_effective_index_name
        if not index_name:
            return RetrievalResult(
                provider="azure_search_study",
                citations=[],
                evidence=[],
                diagnostics=RetrievalDiagnostics(
                    provider="azure_search_study",
                    errors=[
                        "Study index is not configured. Set AZURE_SEARCH_STUDY_INDEX_NAME "
                        "(or AZURE_SEARCH_INDEX_NAME)."
                    ],
                ),
            )

        endpoint = (self._settings.azure_search_service_endpoint or "").strip()
        if not endpoint:
            return RetrievalResult(
                provider="azure_search_study",
                citations=[],
                evidence=[],
                diagnostics=RetrievalDiagnostics(
                    provider="azure_search_study",
                    errors=["AZURE_SEARCH_SERVICE_ENDPOINT is required in study mode."],
                ),
            )

        schema, schema_errors = await self._fetch_index_schema(
            endpoint=endpoint,
            index_name=index_name,
        )
        if schema_errors:
            return RetrievalResult(
                provider="azure_search_study",
                citations=[],
                evidence=[],
                diagnostics=RetrievalDiagnostics(
                    provider="azure_search_study",
                    errors=schema_errors,
                ),
            )

        filter_expression, filter_note = self._build_filter_expression(
            schema=schema,
            session_id=normalized_session_id,
        )
        if not filter_expression:
            return RetrievalResult(
                provider="azure_search_study",
                citations=[],
                evidence=[],
                diagnostics=RetrievalDiagnostics(
                    provider="azure_search_study",
                    errors=[
                        "Study retrieval cannot isolate the uploaded session. "
                        "Configure a filterable session field (for example `study_session_id`) "
                        "or a filterable URL field (for example `url`)."
                    ],
                ),
            )

        vector_field = self._choose_vector_field(schema)
        query_vector: list[float] | None = None
        retrieval_errors = [filter_note] if filter_note else []
        if vector_field:
            try:
                query_vector = await self._embeddings.embed_text(query)
            except RuntimeError as exc:
                retrieval_errors.append(str(exc))

        primary_result = await self._hybrid.retrieve(
            query=query,
            inherited_errors=retrieval_errors,
            filter_expression=filter_expression,
            index_name=index_name,
            vector_fields_override=[vector_field] if vector_field else [],
            query_vector=query_vector,
            provider_label="azure_search_study",
            source_label="azure_search_study",
        )
        relevant_primary_citations = self._filter_relevant_citations(
            query=query,
            citations=primary_result.citations,
        )
        if relevant_primary_citations:
            return RetrievalResult(
                provider="azure_search_study",
                citations=relevant_primary_citations,
                evidence=[citation.snippet for citation in relevant_primary_citations if citation.snippet][:6],
                diagnostics=primary_result.diagnostics,
            )

        primary_errors = [*primary_result.diagnostics.errors]
        if primary_result.citations and not relevant_primary_citations:
            primary_errors.append("Search results were not relevant to the uploaded study file.")

        session_result = await self._fetch_session_documents(
            endpoint=endpoint,
            index_name=index_name,
            filter_expression=filter_expression,
            schema=schema,
            query=query,
        )
        if not session_result.citations:
            return RetrievalResult(
                provider="azure_search_study",
                citations=[],
                evidence=[],
                diagnostics=RetrievalDiagnostics(
                    provider="azure_search_study",
                    used_fallback=primary_result.diagnostics.used_fallback or session_result.diagnostics.used_fallback,
                    errors=[*primary_errors, *session_result.diagnostics.errors],
                    raw={
                        "query_result": primary_result.diagnostics.raw,
                        "session_fallback_result": session_result.diagnostics.raw,
                    },
                ),
            )

        combined_errors = [*primary_errors, "Using session document fallback context."]
        return RetrievalResult(
            provider="azure_search_study",
            citations=session_result.citations,
            evidence=session_result.evidence,
            diagnostics=RetrievalDiagnostics(
                provider="azure_search_study",
                used_fallback=True,
                errors=combined_errors,
                raw={
                    "query_result": primary_result.diagnostics.raw,
                    "session_fallback_result": session_result.diagnostics.raw,
                },
            ),
        )

    def _build_filter_expression(
        self,
        *,
        schema: dict[str, dict[str, Any]],
        session_id: str,
    ) -> tuple[str | None, str | None]:
        escaped_session = session_id.replace("'", "''")

        session_field = self._choose_filterable_field(
            schema=schema,
            candidates=[
                (self._settings.azure_search_study_session_field or "").strip(),
                "study_session_id",
            ],
        )
        if session_field:
            return f"{session_field} eq '{escaped_session}'", None

        url_field = self._choose_filterable_field(
            schema=schema,
            candidates=[
                (self._settings.azure_search_study_url_field or "").strip() or "url",
                "url",
                "source_url",
                "document_url",
                "source",
                "uri",
            ],
        )
        if not url_field:
            return None, None

        return (
            f"{url_field} eq 'study://{escaped_session}'",
            (
                "Study session field not available on this index; "
                f"using URL equality session filter on `{url_field}`."
            ),
        )

    def _choose_vector_field(self, schema: dict[str, dict[str, Any]]) -> str | None:
        candidates = [
            (self._settings.azure_search_study_vector_field or "").strip(),
            "content_vector",
        ]
        for candidate in candidates:
            name = (candidate or "").strip()
            if not name:
                continue
            meta = schema.get(name)
            if not isinstance(meta, dict):
                continue
            field_type = str(meta.get("type") or "").strip()
            dimensions = meta.get("dimensions")
            if field_type == "Collection(Edm.Single)" and dimensions:
                return name
        return None

    async def _fetch_index_schema(
        self,
        *,
        endpoint: str,
        index_name: str,
    ) -> tuple[dict[str, dict[str, Any]], list[str]]:
        url = f"{endpoint.rstrip('/')}/indexes/{index_name}"
        params = {"api-version": self._settings.azure_search_api_version}
        headers = {"content-type": "application/json"}

        auth_error = await self._apply_auth(headers)
        if auth_error:
            return {}, [auth_error]

        async with httpx.AsyncClient(timeout=self._settings.azure_search_timeout_seconds) as client:
            response = await client.get(url, params=params, headers=headers)
            if response.status_code >= 400:
                body_preview = (response.text or "").strip().replace("\n", " ")[:700]
                return {}, [
                    (
                        "Azure Search index schema lookup failed: "
                        f"{response.status_code} {response.reason_phrase}. body={body_preview}"
                    )
                ]

            payload = response.json() if response.content else {}
            fields = payload.get("fields")
            if not isinstance(fields, list):
                return {}, ["Azure Search index schema lookup returned no fields array."]

            schema: dict[str, dict[str, Any]] = {}
            for item in fields:
                if not isinstance(item, dict):
                    continue
                name = str(item.get("name") or "").strip()
                if not name:
                    continue
                schema[name] = item

            if not schema:
                return {}, ["Azure Search index schema has no usable fields."]
            return schema, []

    async def _fetch_session_documents(
        self,
        *,
        endpoint: str,
        index_name: str,
        filter_expression: str,
        schema: dict[str, dict[str, Any]],
        query: str,
    ) -> RetrievalResult:
        url = f"{endpoint.rstrip('/')}/indexes/{index_name}/docs/search"
        params = {"api-version": self._settings.azure_search_api_version}
        headers = {"content-type": "application/json"}

        auth_error = await self._apply_auth(headers)
        if auth_error:
            return RetrievalResult(
                provider="azure_search_study",
                citations=[],
                evidence=[],
                diagnostics=RetrievalDiagnostics(
                    provider="azure_search_study",
                    used_fallback=True,
                    errors=[auth_error],
                ),
            )

        payload: dict[str, Any] = {
            "search": "*",
            "top": max(self._settings.azure_search_top_k, 6),
            "filter": filter_expression,
        }

        order_fields = [
            self._choose_sortable_field(
                schema=schema,
                candidates=[
                    (self._settings.azure_search_study_chunk_index_field or "").strip(),
                    "chunk_index",
                ],
            ),
            self._choose_sortable_field(
                schema=schema,
                candidates=[
                    (self._settings.azure_search_study_uploaded_at_field or "").strip(),
                    "uploaded_at",
                    "published_date",
                ],
            ),
        ]
        order_by = [field for field in order_fields if field]
        if order_by:
            payload["orderby"] = ",".join(f"{field} asc" for field in order_by)

        async with httpx.AsyncClient(timeout=self._settings.azure_search_timeout_seconds) as client:
            response = await client.post(url, params=params, headers=headers, json=payload)
            if response.status_code >= 400:
                body_preview = (response.text or "").strip().replace("\n", " ")[:700]
                return RetrievalResult(
                    provider="azure_search_study",
                    citations=[],
                    evidence=[],
                    diagnostics=RetrievalDiagnostics(
                        provider="azure_search_study",
                        used_fallback=True,
                        errors=[
                            (
                                "Azure Search session fallback failed: "
                                f"{response.status_code} {response.reason_phrase}. body={body_preview}"
                            )
                        ],
                    ),
                )

            raw = response.json() if response.content else {}

        citations = self._extract_session_citations(payload=raw, schema=schema, query=query)
        return RetrievalResult(
            provider="azure_search_study",
            citations=citations,
            evidence=[citation.snippet for citation in citations if citation.snippet][:6],
            diagnostics=RetrievalDiagnostics(
                provider="azure_search_study",
                used_fallback=True,
                errors=[],
                raw=raw,
            ),
        )

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

    @staticmethod
    def _choose_filterable_field(
        *,
        schema: dict[str, dict[str, Any]],
        candidates: list[str | None],
    ) -> str | None:
        for candidate in candidates:
            name = (candidate or "").strip()
            if not name:
                continue
            meta = schema.get(name)
            if not isinstance(meta, dict):
                continue
            if bool(meta.get("filterable")):
                return name
        return None

    @staticmethod
    def _choose_field(
        *,
        schema: dict[str, dict[str, Any]],
        candidates: list[str | None],
    ) -> str | None:
        for candidate in candidates:
            name = (candidate or "").strip()
            if not name:
                continue
            if name in schema:
                return name
        return None

    @staticmethod
    def _choose_sortable_field(
        *,
        schema: dict[str, dict[str, Any]],
        candidates: list[str | None],
    ) -> str | None:
        for candidate in candidates:
            name = (candidate or "").strip()
            if not name:
                continue
            meta = schema.get(name)
            if not isinstance(meta, dict):
                continue
            if bool(meta.get("sortable")):
                return name
        return None

    def _extract_session_citations(
        self,
        *,
        payload: dict[str, Any],
        schema: dict[str, dict[str, Any]],
        query: str,
    ) -> list[Citation]:
        values = payload.get("value")
        if not isinstance(values, list):
            return []

        query_terms = self._keyword_terms(query)

        title_field = self._choose_field(
            schema=schema,
            candidates=[
                (self._settings.azure_search_study_title_field or "").strip(),
                (self._settings.azure_search_study_filename_field or "").strip(),
                "title",
                "study_file_name",
            ],
        )
        content_field = self._choose_field(
            schema=schema,
            candidates=[
                (self._settings.azure_search_study_content_field or "").strip(),
                "content",
                "chunk",
                "chunk_text",
                "text",
            ],
        )
        published_date_field = self._choose_field(
            schema=schema,
            candidates=[
                (self._settings.azure_search_study_uploaded_at_field or "").strip(),
                "uploaded_at",
                "published_date",
            ],
        )

        citations: list[Citation] = []
        for doc in values[: max(self._settings.azure_search_top_k, 6)]:
            if not isinstance(doc, dict):
                continue
            title = str(doc.get(title_field) or "Uploaded study file").strip() if title_field else "Uploaded study file"
            snippet = str(doc.get(content_field) or "").strip() if content_field else ""
            published_date = str(doc.get(published_date_field) or "").strip() if published_date_field else ""
            if not snippet and not title:
                continue
            if query_terms and self._term_overlap_score(query_terms, f"{title} {snippet}") <= 0:
                continue
            citations.append(
                Citation(
                    title=title or "Uploaded study file",
                    url=None,
                    snippet=snippet[:800] or None,
                    published_date=published_date or None,
                    source="azure_search_study",
                    score=None,
                )
            )

        return citations

    def _filter_relevant_citations(self, *, query: str, citations: list[Citation]) -> list[Citation]:
        query_terms = self._keyword_terms(query)
        if not query_terms:
            return citations

        relevant: list[Citation] = []
        for citation in citations:
            haystack = " ".join(
                part for part in [citation.title or "", citation.snippet or ""] if part
            )
            if self._term_overlap_score(query_terms, haystack) > 0:
                relevant.append(citation)
        return relevant

    @staticmethod
    def _keyword_terms(text: str) -> set[str]:
        stop_words = {
            "about",
            "after",
            "again",
            "during",
            "explain",
            "five",
            "from",
            "have",
            "into",
            "make",
            "more",
            "that",
            "them",
            "they",
            "this",
            "what",
            "when",
            "where",
            "which",
            "with",
            "word",
            "words",
            "would",
            "your",
        }
        terms: set[str] = set()
        for raw in re.findall(r"[a-z0-9]+", (text or "").lower()):
            normalized = AzureStudyRAGService._normalize_term(raw)
            if len(normalized) < 3 or normalized in stop_words:
                continue
            terms.add(normalized)
        return terms

    @staticmethod
    def _normalize_term(term: str) -> str:
        normalized = (term or "").strip().lower()
        for suffix in ("ations", "ation", "ments", "ment", "ingly", "edly", "ingly", "ingly", "ing", "ers", "ies", "ied", "ions", "ion", "es", "ed", "s"):
            if normalized.endswith(suffix) and len(normalized) - len(suffix) >= 3:
                if suffix in {"ies", "ied"}:
                    return normalized[:-3] + "y"
                return normalized[: -len(suffix)]
        return normalized

    @classmethod
    def _term_overlap_score(cls, query_terms: set[str], text: str) -> int:
        if not query_terms:
            return 0
        document_terms = cls._keyword_terms(text)
        return len(query_terms & document_terms)
