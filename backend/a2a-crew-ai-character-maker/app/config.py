from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    openai_api_key: str
    openai_model: str = "openai/gpt-4o-mini"
    openai_temperature: float = 0.6
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

    a2a_public_base_url: str = "http://127.0.0.1:8000"
    a2a_rpc_path: str = "/a2a"
    a2a_agent_name: str = "Dream CrewAI Character Agent"
    a2a_agent_version: str = "0.1.0"

    crewai_verbose: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def a2a_rpc_url(self) -> str:
        return f"{self.a2a_public_base_url.rstrip('/')}/{self.a2a_rpc_path.lstrip('/')}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
