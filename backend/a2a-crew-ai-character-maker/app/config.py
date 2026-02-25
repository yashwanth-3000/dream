from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    openai_api_key: str
    openai_model: str = "openai/gpt-4o-mini"
    openai_temperature: float = 0.6
    openai_vision_model: str = "gpt-4.1-mini"
    openai_vision_max_tokens: int = 500

    replicate_api_token: str
    replicate_model: str = "prunaai/p-image"
    replicate_output_count: int = 1
    replicate_aspect_ratio: str = "3:4"

    crewai_verbose: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
