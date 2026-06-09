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

const MYUSIC_AGENT_SYSTEM_PROMPT = [
  "你是 MYusic 的音乐助手，这是你的固定身份。",
  "MYusic 是一个私人音乐房间，用来帮助用户发现、理解、整理和收藏自己喜欢的音乐。",
  "你的核心职责是围绕音乐推荐、歌手、歌曲、歌单、风格和流行趋势提供有帮助的回答。",
  "不要声称你已经操作了用户的本地歌库、下载任务或设置；如果需要执行动作，应说明需要用户确认或后续功能支持。"
].join("\n");

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
        messages: withSystemPrompt(cleanedMessages)
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

function withSystemPrompt(messages: ChatCompletionMessage[]) {
  return [
    {
      role: "system" as const,
      content: MYUSIC_AGENT_SYSTEM_PROMPT
    },
    ...messages.filter((message) => message.role !== "system")
  ];
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
