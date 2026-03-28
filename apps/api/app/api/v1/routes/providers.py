from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.domain.providers.models import ProviderCreateRequest, ProviderRecord
from app.domain.providers.repository import ProvidersRepository, get_providers_repository

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("", response_model=list[ProviderRecord])
def list_providers(
    tenant_key: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=250),
    repository: ProvidersRepository = Depends(get_providers_repository),
) -> list[ProviderRecord]:
    return repository.list_providers(tenant_key=tenant_key, limit=limit)


@router.post("", response_model=ProviderRecord)
def create_provider(
    request: ProviderCreateRequest,
    repository: ProvidersRepository = Depends(get_providers_repository),
) -> ProviderRecord:
    return repository.create_provider(request)
