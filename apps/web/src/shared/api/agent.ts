const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export type AgentChatRequest = {
  message: string;
  context: {
    active_view?: string;
    claim_id?: string | null;
  };
};

export type AgentClaimLink = {
  claim_id: string;
  label?: string | null;
};

export type AgentChatResponse = {
  reply: string;
  claim_links: AgentClaimLink[];
};

export async function chatWithAgent(req: AgentChatRequest): Promise<AgentChatResponse> {
  const response = await fetch(`${API_BASE_URL}/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    throw new Error("Agent unavailable");
  }
  return response.json() as Promise<AgentChatResponse>;
}
