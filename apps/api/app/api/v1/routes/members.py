from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.domain.members.models import MemberDetailResponse, MemberListItem
from app.domain.members.repository import MembersRepository, get_members_repository

router = APIRouter(prefix="/members", tags=["members"])


@router.get("", response_model=list[MemberListItem])
def list_members(
    tenant_key: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=250),
    repository: MembersRepository = Depends(get_members_repository),
) -> list[MemberListItem]:
    return repository.list_members(tenant_key=tenant_key, limit=limit)


@router.get("/{member_id}", response_model=MemberDetailResponse)
def get_member(
    member_id: str,
    repository: MembersRepository = Depends(get_members_repository),
) -> MemberDetailResponse:
    member = repository.get_member(member_id)
    if member is None:
        raise HTTPException(status_code=404, detail=f"Member {member_id} not found.")
    return member
