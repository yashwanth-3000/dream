from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


AgentProvider = Literal["openai", "azure"]


class Settings(BaseSettings):
    app_env: str = "dev"
    app_debug: bool = False

    agent_provider: AgentProvider = "openai"

    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_temperature: float = 0.5

    azure_openai_endpoint: str | None = None
    azure_openai_api_key: str | None = None
    azure_openai_chat_deployment_name: str | None = None
    azure_openai_api_version: str = "preview"

    openai_vision_model: str = "gpt-4.1-mini"
    openai_vision_max_tokens: int = 500

    replicate_api_token: str
    replicate_model: str = "openai/gpt-image-1.5"
    replicate_output_count: int = 1
    replicate_aspect_ratio: str = "2:3"
    replicate_quality: str = "medium"
    replicate_background: str = "auto"
    replicate_moderation: str = "auto"
    replicate_output_format: str = "webp"
    replicate_input_fidelity: str = "high"
    replicate_output_compression: int = 90
    scene_image_timeout_seconds: float = Field(default=70.0, gt=1.0)
    scene_image_retry_count: int = Field(default=1, ge=0, le=5)

    character_backend_base_url: str = "http://127.0.0.1:8000"
    character_backend_rpc_path: str = "/a2a"
    character_backend_use_protocol: bool = True
    character_backend_create_path: str = "/api/v1/characters/create"
    character_backend_timeout_seconds: float = Field(default=240.0, gt=0.0)

    a2a_public_base_url: str = "http://127.0.0.1:8020"
    a2a_rpc_path: str = "/a2a"
    a2a_agent_name: str = "Dream MAF Story Book Agent"
    a2a_agent_version: str = "0.1.0"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_credentials(self) -> "Settings":
        self.openai_model = self._normalize_openai_model(self.openai_model)
        self.openai_vision_model = self._normalize_openai_model(self.openai_vision_model)

        if not self.character_backend_use_protocol:
            raise ValueError("A2A-only mode: CHARACTER_BACKEND_USE_PROTOCOL must be true.")

        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required (used by MAF and vision analysis).")

        if self.agent_provider == "azure":
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
    def character_backend_rpc_url(self) -> str:
        return self._join_url(self.character_backend_base_url, self.character_backend_rpc_path)

    @property
    def character_backend_create_url(self) -> str:
        return self._join_url(self.character_backend_base_url, self.character_backend_create_path)

    @property
    def a2a_rpc_url(self) -> str:
        return self._join_url(self.a2a_public_base_url, self.a2a_rpc_path)

    @staticmethod
    def _join_url(base_url: str, path: str) -> str:
        return f"{base_url.rstrip('/')}/{path.lstrip('/')}"

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
