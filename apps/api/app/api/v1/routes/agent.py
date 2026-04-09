from fastapi import APIRouter, Depends

from app.domain.agent.models import AgentChatRequest, AgentChatResponse
from app.domain.agent.service import AgentChatService, get_agent_chat_service

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/chat", response_model=AgentChatResponse)
def chat_with_agent(
    request: AgentChatRequest,
    service: AgentChatService = Depends(get_agent_chat_service),
) -> AgentChatResponse:
    try:
        reply = service.answer(message=request.message, context=request.context)
    except Exception:
        reply = "I don't have enough context to answer that right now. Try asking about a claim, member, provider, or policy."
    return AgentChatResponse(reply=reply)
