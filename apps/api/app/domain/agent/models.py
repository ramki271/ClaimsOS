from typing import Optional

from pydantic import BaseModel, Field


class AgentChatContext(BaseModel):
    active_view: Optional[str] = None
    claim_id: Optional[str] = None


class AgentChatRequest(BaseModel):
    message: str = Field(min_length=1)
    context: AgentChatContext = Field(default_factory=AgentChatContext)


class AgentChatResponse(BaseModel):
    reply: str
