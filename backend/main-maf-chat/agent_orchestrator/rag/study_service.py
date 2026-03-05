from __future__ import annotations

from typing import Any

import httpx

from ..config import Settings
from .azure_search_hybrid import AzureSearchHybridRetriever
from .models import RetrievalDiagnostics, RetrievalResult

try:
    from azure.identity.aio import DefaultAzureCredential
except Exception:  # pragma: no cover - optional dependency
    DefaultAzureCredential = None  # type: ignore[assignment]


class AzureStudyRAGService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._hybrid = AzureSearchHybridRetriever(settings)

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

        return await self._hybrid.retrieve(
            query=query,
            inherited_errors=[filter_note] if filter_note else [],
            filter_expression=filter_expression,
            index_name=index_name,
            provider_label="azure_search_study",
            source_label="azure_search_study",
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
