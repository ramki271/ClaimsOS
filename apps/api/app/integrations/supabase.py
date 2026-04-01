import time
from functools import lru_cache
from typing import Any, Optional

import httpx

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


def execute_with_retry(request_builder: Any, *, attempts: int = 3, delay_seconds: float = 0.2) -> Any:
    last_error: Optional[Exception] = None
    for attempt in range(attempts):
        try:
            return request_builder.execute()
        except httpx.ReadError as exc:
            last_error = exc
            if attempt == attempts - 1:
                raise
            time.sleep(delay_seconds * (attempt + 1))
    if last_error is not None:
        raise last_error
    raise RuntimeError("Supabase request failed without an exception.")
