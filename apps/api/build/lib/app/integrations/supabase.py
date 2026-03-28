from functools import lru_cache
from typing import Any

from app.core.config import get_settings


def _resolve_key(use_service_role: bool) -> str:
    settings = get_settings()
    if use_service_role and settings.supabase_service_role_key:
        return settings.supabase_service_role_key
    return settings.supabase_anon_key


@lru_cache
def get_supabase_client(use_service_role: bool = False) -> Any:
    settings = get_settings()

    try:
        from supabase import create_client
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "The Supabase Python client is not installed in this environment. "
            "Activate the API virtualenv and run `pip install '.[dev]'` from apps/api."
        ) from exc

    if not settings.supabase_url or not _resolve_key(use_service_role):
        raise RuntimeError(
            "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY."
        )

    return create_client(settings.supabase_url, _resolve_key(use_service_role))
