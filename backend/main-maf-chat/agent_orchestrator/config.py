from __future__ import annotations

from functools import lru_cache
from typing import Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


AgentProvider = Literal["openai", "azure"]


class Settings(BaseSettings):
    app_env: str = "dev"
    app_debug: bool = False

    agent_provider: AgentProvider = "openai"

    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"

    azure_openai_endpoint: str | None = None
    azure_openai_api_key: str | None = None
    azure_openai_chat_deployment_name: str | None = None
    azure_openai_api_version: str = "preview"
    azure_openai_embedding_endpoint: str | None = None
    azure_openai_embedding_api_key: str | None = None
    azure_openai_embedding_deployment_name: str | None = None
    azure_openai_embedding_api_version: str = "2024-10-21"

    applicationinsights_connection_string: str | None = None

    exa_api_key: str | None = None
    exa_mcp_enabled: bool = True
    exa_mcp_base_url: str = "https://mcp.exa.ai/mcp"
    exa_mcp_tools: str | None = "web_search_exa"
    exa_mcp_required_in_search: bool = True
    exa_mcp_timeout_seconds: float = Field(default=20.0, gt=0.0)
    exa_search_top_k: int = Field(default=6, ge=1, le=20)

    azure_search_service_endpoint: str | None = None
    azure_search_api_key: str | None = None
    azure_search_index_name: str | None = None
    azure_search_knowledge_base_name: str | None = None
    azure_search_mcp_enabled: bool = True
    azure_search_fallback_enabled: bool = True
    azure_search_use_managed_identity: bool = False
    azure_search_api_version: str = "2025-09-01"
    azure_search_mcp_api_version: str = "2025-11-01-preview"
    azure_search_semantic_configuration: str | None = None
    azure_search_top_k: int = Field(default=6, ge=1, le=20)
    azure_search_vector_k: int = Field(default=20, ge=1, le=100)
    azure_search_timeout_seconds: float = Field(default=30.0, gt=0.0)
    azure_search_mcp_timeout_seconds: float = Field(default=30.0, gt=0.0)
    azure_search_select_fields_raw: str | None = None
    azure_search_content_fields_raw: str | None = "content,chunk,chunk_text,text"
    azure_search_title_fields_raw: str | None = "title,document_title,source_title,name"
    azure_search_url_fields_raw: str | None = "url,source_url,document_url,source,uri"
    azure_search_vector_fields_raw: str | None = None
    azure_search_study_enabled: bool = True
    azure_search_study_index_name: str | None = None
    azure_search_study_session_field: str = "study_session_id"
    azure_search_study_id_field: str = "id"
    azure_search_study_content_field: str = "content"
    azure_search_study_title_field: str = "title"
    azure_search_study_url_field: str = "url"
    azure_search_study_filename_field: str = "study_file_name"
    azure_search_study_chunk_index_field: str = "chunk_index"
    azure_search_study_uploaded_at_field: str = "uploaded_at"
    azure_search_study_vector_field: str = "content_vector"
    azure_search_study_vector_dimensions: int = Field(default=1536, ge=128, le=4096)
    azure_search_study_chunk_size_chars: int = Field(default=1400, ge=300, le=8000)
    azure_search_study_chunk_overlap_chars: int = Field(default=200, ge=0, le=2000)
    azure_search_study_max_file_bytes: int = Field(default=20_000_000, ge=1_000_000, le=200_000_000)

    azure_content_safety_enabled: bool = False
    azure_content_safety_endpoint: str | None = None
    azure_content_safety_api_key: str | None = None
    azure_content_safety_api_version: str = "2024-09-01"
    azure_content_safety_block_severity: int = Field(default=4, ge=0, le=7)
    azure_content_safety_timeout_seconds: float = Field(default=10.0, gt=0.0)
    azure_content_safety_fail_open: bool = True

    a2a_backend_base_url: str = "http://127.0.0.1:8000"
    a2a_rpc_path: str = "/a2a"
    a2a_use_protocol: bool = True
    a2a_create_path: str = "/api/v1/characters/create"
    a2a_regenerate_path: str = "/api/v1/characters/regenerate-image"
    a2a_story_backend_base_url: str = "http://127.0.0.1:8020"
    a2a_story_rpc_path: str = "/a2a"
    a2a_story_use_protocol: bool = True
    a2a_story_create_path: str = "/api/v1/stories/create"
    a2a_quiz_backend_base_url: str = "http://127.0.0.1:8030"
    a2a_quiz_rpc_path: str = "/a2a"
    a2a_quiz_use_protocol: bool = True
    a2a_quiz_create_path: str = "/api/v1/quizzes/create"
    a2a_timeout_seconds: float = Field(default=240.0, gt=0.0)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_provider_credentials(self) -> "Settings":
        self.openai_model = self._normalize_openai_model(self.openai_model)

        if not self.a2a_use_protocol:
            raise ValueError("A2A-only mode: A2A_USE_PROTOCOL must be true.")
        if not self.a2a_story_use_protocol:
            raise ValueError("A2A-only mode: A2A_STORY_USE_PROTOCOL must be true.")
        if not self.a2a_quiz_use_protocol:
            raise ValueError("A2A-only mode: A2A_QUIZ_USE_PROTOCOL must be true.")

        if self.agent_provider == "openai":
            if not self.openai_api_key:
                raise ValueError("OPENAI_API_KEY is required when AGENT_PROVIDER=openai.")
            return self

        if not self.azure_openai_endpoint:
            raise ValueError("AZURE_OPENAI_ENDPOINT is required when AGENT_PROVIDER=azure.")
        if not self.azure_openai_api_key:
            raise ValueError("AZURE_OPENAI_API_KEY is required when AGENT_PROVIDER=azure.")
        if not self.azure_openai_chat_deployment_name:
            raise ValueError(
                "AZURE_OPENAI_CHAT_DEPLOYMENT_NAME is required when AGENT_PROVIDER=azure."
            )
        return self

    @property
    def a2a_create_url(self) -> str:
        return self._join_url(self.a2a_backend_base_url, self.a2a_create_path)

    @property
    def a2a_regenerate_url(self) -> str:
        return self._join_url(self.a2a_backend_base_url, self.a2a_regenerate_path)

    @property
    def a2a_rpc_url(self) -> str:
        return self._join_url(self.a2a_backend_base_url, self.a2a_rpc_path)

    @property
    def a2a_story_create_url(self) -> str:
        return self._join_url(self.a2a_story_backend_base_url, self.a2a_story_create_path)

    @property
    def a2a_story_rpc_url(self) -> str:
        return self._join_url(self.a2a_story_backend_base_url, self.a2a_story_rpc_path)

    @property
    def a2a_quiz_create_url(self) -> str:
        return self._join_url(self.a2a_quiz_backend_base_url, self.a2a_quiz_create_path)

    @property
    def a2a_quiz_rpc_url(self) -> str:
        return self._join_url(self.a2a_quiz_backend_base_url, self.a2a_quiz_rpc_path)

    @property
    def azure_search_select_fields(self) -> list[str]:
        return self._split_csv(self.azure_search_select_fields_raw)

    @property
    def azure_search_content_fields(self) -> list[str]:
        fields = self._split_csv(self.azure_search_content_fields_raw)
        return fields or ["content", "chunk", "chunk_text", "text"]

    @property
    def azure_search_title_fields(self) -> list[str]:
        fields = self._split_csv(self.azure_search_title_fields_raw)
        return fields or ["title", "document_title", "source_title", "name"]

    @property
    def azure_search_url_fields(self) -> list[str]:
        fields = self._split_csv(self.azure_search_url_fields_raw)
        return fields or ["url", "source_url", "document_url", "source", "uri"]

    @property
    def azure_search_vector_fields(self) -> list[str]:
        return self._split_csv(self.azure_search_vector_fields_raw)

    @property
    def azure_search_mcp_url(self) -> str | None:
        endpoint = (self.azure_search_service_endpoint or "").strip()
        kb_name = (self.azure_search_knowledge_base_name or "").strip()
        if not endpoint or not kb_name:
            return None

        base = f"{endpoint.rstrip('/')}/knowledgebases/{kb_name}/mcp"
        parsed = urlsplit(base)
        query_pairs = dict(parse_qsl(parsed.query, keep_blank_values=False))
        query_pairs["api-version"] = (self.azure_search_mcp_api_version or "").strip() or "2025-11-01-preview"

        query = urlencode(query_pairs)
        return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, parsed.fragment))

    @property
    def exa_mcp_url(self) -> str | None:
        base_url = (self.exa_mcp_base_url or "").strip()
        if not base_url:
            return None

        parsed = urlsplit(base_url)
        query_pairs = dict(parse_qsl(parsed.query, keep_blank_values=False))
        exa_api_key = (self.exa_api_key or "").strip()
        if exa_api_key:
            query_pairs["exaApiKey"] = exa_api_key
        tools = (self.exa_mcp_tools or "").strip()
        if tools:
            query_pairs["tools"] = tools

        query = urlencode(query_pairs)
        return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, parsed.fragment))

    @property
    def exa_mcp_tool_names(self) -> list[str]:
        tools = (self.exa_mcp_tools or "").strip()
        if not tools:
            return []
        return [name.strip() for name in tools.split(",") if name.strip()]

    @property
    def azure_search_study_effective_index_name(self) -> str | None:
        candidate = (self.azure_search_study_index_name or "").strip()
        if candidate:
            return candidate
        fallback = (self.azure_search_index_name or "").strip()
        return fallback or None

    @staticmethod
    def _join_url(base_url: str, path: str) -> str:
        return f"{base_url.rstrip('/')}/{path.lstrip('/')}"

    @staticmethod
    def _split_csv(raw: str | None) -> list[str]:
        value = (raw or "").strip()
        if not value:
            return []
        return [token.strip() for token in value.split(",") if token.strip()]

    @staticmethod
    def _normalize_openai_model(model_id: str) -> str:
        raw = (model_id or "").strip()
        if not raw:
            return "gpt-4o-mini"

        lowered = raw.lower()
        for prefix in ("openai/", "models/", "model/"):
            if lowered.startswith(prefix):
                return raw[len(prefix) :].strip() or "gpt-4o-mini"

        return raw


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
