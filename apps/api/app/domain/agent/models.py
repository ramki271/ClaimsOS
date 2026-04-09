from typing import Optional

from pydantic import BaseModel, Field


class AgentChatContext(BaseModel):
    active_view: Optional[str] = None
    claim_id: Optional[str] = None


class AgentChatRequest(BaseModel):
    message: str = Field(min_length=1)
    context: AgentChatContext = Field(default_factory=AgentChatContext)


class AgentClaimLink(BaseModel):
    claim_id: str
    label: Optional[str] = None


class AgentChatResponse(BaseModel):
    reply: str
    claim_links: list[AgentClaimLink] = Field(default_factory=list)
