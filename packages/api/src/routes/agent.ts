import type { FastifyInstance } from "fastify";
import type { ApiConfig } from "../config";
import { AgentService, type ChatCompletionMessage } from "../services/agent-service";

export function registerAgentRoutes(app: FastifyInstance, config: ApiConfig) {
  const agent = new AgentService(config.agent);

  app.post<{ Body: { messages?: ChatCompletionMessage[] } }>("/api/agent/chat", async (request, reply) => {
    const messages = Array.isArray(request.body?.messages) ? request.body.messages : [];
    if (!messages.length) {
      reply.code(400);
      return { error: "Please send at least one message." };
    }

    return { reply: await agent.chat(messages) };
  });
}
