from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from io import BytesIO
from typing import Any
from uuid import uuid4

import httpx

from ..config import Settings
from .azure_openai_embeddings import AzureOpenAIEmbeddingClient

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover - optional dependency
    PdfReader = None  # type: ignore[assignment]

try:
    from azure.identity.aio import DefaultAzureCredential
except Exception:  # pragma: no cover - optional dependency
    DefaultAzureCredential = None  # type: ignore[assignment]


@dataclass(slots=True)
class StudyUploadResult:
    session_id: str
    file_id: str
    filename: str
    chunks_indexed: int = 0
    provider: str = "azure_search_study"
    index_name: str | None = None
    errors: list[str] = field(default_factory=list)


class StudyDocumentIndexer:
    _TEXT_EXTENSIONS = {
        ".txt",
        ".md",
        ".markdown",
        ".csv",
        ".json",
        ".xml",
        ".html",
        ".htm",
        ".yaml",
        ".yml",
        ".log",
    }
    _TEXT_CONTENT_TYPES = {
        "text/plain",
        "text/markdown",
        "text/csv",
        "text/html",
        "text/xml",
        "application/json",
        "application/xml",
        "application/yaml",
        "text/yaml",
        "text/x-log",
    }

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._embeddings = AzureOpenAIEmbeddingClient(settings)

    async def upload_document(
        self,
        *,
        file_name: str,
        file_bytes: bytes,
        content_type: str | None = None,
        session_id: str | None = None,
    ) -> StudyUploadResult:
        normalized_name = (file_name or "study-document.pdf").strip() or "study-document.pdf"
        normalized_session = (session_id or "").strip() or uuid4().hex
        normalized_session = normalized_session[:128]

        result = StudyUploadResult(
            session_id=normalized_session,
            file_id=uuid4().hex,
            filename=normalized_name,
            index_name=self._settings.azure_search_study_effective_index_name,
        )

        if not self._settings.azure_search_study_enabled:
            result.errors.append("AZURE_SEARCH_STUDY_ENABLED is false.")
            return result

        max_size = self._settings.azure_search_study_max_file_bytes
        if len(file_bytes) > max_size:
            result.errors.append(
                f"File exceeds study upload size limit ({max_size} bytes)."
            )
            return result

        endpoint = (self._settings.azure_search_service_endpoint or "").strip()
        index_name = (self._settings.azure_search_study_effective_index_name or "").strip()
        if not endpoint or not index_name:
            result.errors.append(
                "Azure Search study upload is not configured. "
                "Set AZURE_SEARCH_SERVICE_ENDPOINT and AZURE_SEARCH_STUDY_INDEX_NAME "
                "(or AZURE_SEARCH_INDEX_NAME)."
            )
            return result

        extracted_text = self._extract_document_text(
            file_name=normalized_name,
            file_bytes=file_bytes,
            content_type=content_type,
        )
        if not extracted_text.strip():
            result.errors.append(
                "No extractable text was found in the uploaded study document."
            )
            return result

        chunks = self._chunk_text(extracted_text)
        if not chunks:
            result.errors.append("Study chunking produced no chunks.")
            return result

        schema, schema_errors = await self._fetch_index_schema(
            endpoint=endpoint,
            index_name=index_name,
        )
        if schema_errors:
            result.errors.extend(schema_errors)
            return result

        vector_field = self._choose_vector_field(schema)
        chunk_embeddings: list[list[float]] | None = None
        if vector_field:
            try:
                chunk_embeddings = await self._embeddings.embed_texts(chunks)
            except RuntimeError as exc:
                result.errors.append(str(exc))
                chunk_embeddings = None

        try:
            documents = self._build_documents(
                session_id=normalized_session,
                file_id=result.file_id,
                file_name=normalized_name,
                chunks=chunks,
                schema=schema,
                chunk_embeddings=chunk_embeddings,
            )
        except RuntimeError as exc:
            result.errors.append(str(exc))
            return result

        indexed_count, indexing_errors = await self._index_documents(
            endpoint=endpoint,
            index_name=index_name,
            documents=documents,
        )
        result.chunks_indexed = indexed_count
        if indexing_errors:
            result.errors.extend(indexing_errors)
        return result

    def _extract_document_text(
        self,
        *,
        file_name: str,
        file_bytes: bytes,
        content_type: str | None = None,
    ) -> str:
        if self.is_supported_pdf(file_name=file_name, content_type=content_type):
            return self._extract_pdf_text(file_bytes)
        if self.is_supported_text(file_name=file_name, content_type=content_type):
            return self._extract_text_document(file_bytes)
        raise RuntimeError(
            "Unsupported study file type. Supported files: PDF, TXT, MD, CSV, JSON, XML, HTML, YAML, LOG."
        )

    def _extract_pdf_text(self, file_bytes: bytes) -> str:
        if PdfReader is None:
            raise RuntimeError("pypdf is not installed in this runtime.")

        reader = PdfReader(BytesIO(file_bytes))
        parts: list[str] = []
        for page in reader.pages:
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""
            cleaned = " ".join(text.split())
            if cleaned:
                parts.append(cleaned)
        return "\n\n".join(parts)

    def _extract_text_document(self, file_bytes: bytes) -> str:
        for encoding in ("utf-8", "utf-8-sig", "utf-16", "latin-1"):
            try:
                text = file_bytes.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise RuntimeError("Could not decode the uploaded text document.")
        return text

    def _chunk_text(self, text: str) -> list[str]:
        normalized = " ".join((text or "").split()).strip()
        if not normalized:
            return []

        chunk_size = self._settings.azure_search_study_chunk_size_chars
        overlap = self._settings.azure_search_study_chunk_overlap_chars
        if overlap >= chunk_size:
            overlap = max(0, chunk_size // 5)

        chunks: list[str] = []
        step = max(1, chunk_size - overlap)
        position = 0
        while position < len(normalized):
            chunk = normalized[position : position + chunk_size].strip()
            if chunk:
                chunks.append(chunk)
            position += step
        return chunks

    def _build_documents(
        self,
        *,
        session_id: str,
        file_id: str,
        file_name: str,
        chunks: list[str],
        schema: dict[str, dict[str, Any]],
        chunk_embeddings: list[list[float]] | None = None,
    ) -> list[dict[str, object]]:
        now_iso = datetime.now(timezone.utc).isoformat()

        id_field = self._choose_field(
            schema,
            [
                (self._settings.azure_search_study_id_field or "").strip() or "id",
                "id",
                self._find_key_field(schema),
            ],
        )
        if not id_field:
            raise RuntimeError(
                "Study index does not expose a key field for uploads. "
                "Ensure the Azure Search index has a key field (for example `id`)."
            )

        content_field = self._choose_field(
            schema,
            [
                (self._settings.azure_search_study_content_field or "").strip() or "content",
                "content",
                "chunk",
                "chunk_text",
                "text",
            ],
        )
        if not content_field:
            raise RuntimeError(
                "Study index does not expose a supported content field. "
                "Expected one of: content, chunk, chunk_text, text."
            )

        title_field = self._choose_field(
            schema,
            [
                (self._settings.azure_search_study_title_field or "").strip() or "title",
                "title",
                "document_title",
                "source_title",
                "name",
            ],
        )
        url_field = self._choose_field(
            schema,
            [
                (self._settings.azure_search_study_url_field or "").strip() or "url",
                "url",
                "source_url",
                "document_url",
                "source",
                "uri",
            ],
        )
        # Session field is optional. If unavailable, retrieval falls back to URL prefix filtering.
        session_field = self._choose_field(
            schema,
            [
                (self._settings.azure_search_study_session_field or "").strip(),
                "study_session_id",
            ],
        )
        filename_field = self._choose_field(
            schema,
            [
                (self._settings.azure_search_study_filename_field or "").strip(),
                "study_file_name",
            ],
        )
        chunk_index_field = self._choose_field(
            schema,
            [
                (self._settings.azure_search_study_chunk_index_field or "").strip(),
                "chunk_index",
            ],
        )
        uploaded_at_field = self._choose_field(
            schema,
            [
                (self._settings.azure_search_study_uploaded_at_field or "").strip(),
                "uploaded_at",
            ],
        )
        vector_field = self._choose_vector_field(schema)
        published_date_field = self._choose_field(schema, ["published_date"])

        docs: list[dict[str, object]] = []
        for idx, chunk in enumerate(chunks, start=1):
            doc_id = f"{session_id}-{file_id}-{idx}"
            doc: dict[str, object] = {"@search.action": "upload"}
            doc[id_field] = doc_id
            doc[content_field] = chunk
            if title_field:
                doc[title_field] = file_name
            if url_field:
                # Keep one stable URL per session so study retrieval can use an equality filter.
                doc[url_field] = f"study://{session_id}"
            if session_field:
                doc[session_field] = session_id
            if filename_field:
                doc[filename_field] = file_name
            if chunk_index_field:
                doc[chunk_index_field] = idx
            if uploaded_at_field:
                doc[uploaded_at_field] = now_iso
            if vector_field and chunk_embeddings and idx - 1 < len(chunk_embeddings):
                doc[vector_field] = chunk_embeddings[idx - 1]
            if published_date_field:
                doc[published_date_field] = now_iso
            docs.append(doc)
        return docs

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

    async def _index_documents(
        self,
        *,
        endpoint: str,
        index_name: str,
        documents: list[dict[str, object]],
    ) -> tuple[int, list[str]]:
        url = f"{endpoint.rstrip('/')}/indexes/{index_name}/docs/index"
        params = {"api-version": self._settings.azure_search_api_version}
        headers = {"content-type": "application/json"}

        auth_error = await self._apply_auth(headers)
        if auth_error:
            return 0, [auth_error]

        total_indexed = 0
        errors: list[str] = []
        batch_size = 500

        async with httpx.AsyncClient(timeout=self._settings.azure_search_timeout_seconds) as client:
            for start in range(0, len(documents), batch_size):
                batch = documents[start : start + batch_size]
                response = await client.post(
                    url,
                    params=params,
                    headers=headers,
                    json={"value": batch},
                )
                try:
                    response.raise_for_status()
                except Exception as exc:
                    body_preview = (response.text or "").strip().replace("\n", " ")[:700]
                    errors.append(
                        f"Azure Search indexing request failed: {exc}. body={body_preview}"
                    )
                    continue

                payload = response.json() if response.content else {}
                values = payload.get("value")
                if not isinstance(values, list):
                    total_indexed += len(batch)
                    continue

                for item in values:
                    if not isinstance(item, dict):
                        continue
                    status = bool(item.get("status", False))
                    if status:
                        total_indexed += 1
                        continue
                    key = str(item.get("key") or "unknown")
                    message = str(item.get("errorMessage") or "Azure Search rejected a document.")
                    errors.append(f"{key}: {message}")

        return total_indexed, errors

    @staticmethod
    def _choose_field(
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
    def _find_key_field(schema: dict[str, dict[str, Any]]) -> str | None:
        for name, meta in schema.items():
            if bool(meta.get("key")):
                return name
        return None

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

    @classmethod
    def is_supported_pdf(cls, *, file_name: str, content_type: str | None = None) -> bool:
        lowered_name = (file_name or "").strip().lower()
        normalized_type = (content_type or "").strip().lower()
        return lowered_name.endswith(".pdf") or normalized_type in {
            "application/pdf",
            "application/x-pdf",
        }

    @classmethod
    def is_supported_text(cls, *, file_name: str, content_type: str | None = None) -> bool:
        lowered_name = (file_name or "").strip().lower()
        normalized_type = (content_type or "").strip().lower()
        return any(lowered_name.endswith(ext) for ext in cls._TEXT_EXTENSIONS) or (
            normalized_type in cls._TEXT_CONTENT_TYPES
        )

    @classmethod
    def is_supported_upload(cls, *, file_name: str, content_type: str | None = None) -> bool:
        return cls.is_supported_pdf(file_name=file_name, content_type=content_type) or cls.is_supported_text(
            file_name=file_name,
            content_type=content_type,
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
