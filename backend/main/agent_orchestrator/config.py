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

    azure_openai_endpoint: str | None = None
    azure_openai_api_key: str | None = None
    azure_openai_chat_deployment_name: str | None = None
    azure_openai_api_version: str = "preview"

    a2a_backend_base_url: str = "http://127.0.0.1:8000"
    a2a_rpc_path: str = "/a2a"
    a2a_use_protocol: bool = True
    a2a_create_path: str = "/api/v1/characters/create"
    a2a_regenerate_path: str = "/api/v1/characters/regenerate-image"
    a2a_timeout_seconds: float = Field(default=240.0, gt=0.0)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_provider_credentials(self) -> "Settings":
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

    @staticmethod
    def _join_url(base_url: str, path: str) -> str:
        return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
