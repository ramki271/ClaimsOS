from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ClaimsOS API"
    app_env: str = "development"
    api_prefix: str = "/api"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]
    human_review_threshold: float = 0.72
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: Optional[str] = None
    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-large"
    openai_claim_intake_model: str = "gpt-4o-mini"
    openai_vector_store_prefix: str = "claimsos-policies"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def has_supabase(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key)

    @property
    def has_openai(self) -> bool:
        return bool(self.openai_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
