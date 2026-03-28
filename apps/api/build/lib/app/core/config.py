from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ClaimsOS API"
    app_env: str = "development"
    api_prefix: str = "/api"
    cors_origins: list[str] = ["http://localhost:5173"]
    human_review_threshold: float = 0.72
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def has_supabase(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
