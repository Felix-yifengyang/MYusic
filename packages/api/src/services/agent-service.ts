import type { ApiConfig } from "../config";

export type ChatCompletionRole = "system" | "user" | "assistant";

export interface ChatCompletionMessage {
  role: ChatCompletionRole;
  content: string;
}

interface DeepSeekChatCompletionChoice {
  message?: {
    role?: string;
    content?: string;
  };
}

interface DeepSeekChatCompletionResponse {
  choices?: DeepSeekChatCompletionChoice[];
  error?: {
    message?: string;
  };
}

export class AgentService {
  constructor(private readonly config: ApiConfig["agent"]) {}

  async chat(messages: ChatCompletionMessage[]): Promise<string> {
    if (!this.config.deepseekApiKey) {
      throw new Error("AgentService is not configured. Set MYUSIC_DEEPSEEK_API_KEY or DEEPSEEK_API_KEY.");
    }

    const cleanedMessages = sanitizeMessages(messages);
    if (!cleanedMessages.some((message) => message.role === "user")) {
      throw new Error("AgentService.chat requires at least one user message.");
    }

    const response = await fetch(`${this.config.deepseekBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.deepseekApiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: cleanedMessages
      })
    });

    const body = await response.json().catch(() => ({})) as DeepSeekChatCompletionResponse;
    if (!response.ok) {
      throw new Error(body.error?.message || `DeepSeek request failed: ${response.status}`);
    }

    const assistantReply = body.choices?.[0]?.message?.content?.trim();
    if (!assistantReply) {
      throw new Error("DeepSeek returned an empty assistant reply.");
    }

    return assistantReply;
  }
}

function sanitizeMessages(messages: ChatCompletionMessage[]) {
  return messages
    .filter((message) => isChatCompletionRole(message.role) && typeof message.content === "string" && message.content.trim())
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 8000)
    }));
}

function isChatCompletionRole(role: string): role is ChatCompletionRole {
  return role === "system" || role === "user" || role === "assistant";
}
