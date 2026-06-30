import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuthRole } from "@myusic/shared";
import type { AuthService } from "../auth";
import { readCookie } from "../auth";

export function registerUserRoutes(app: FastifyInstance, auth: AuthService | undefined) {
  app.get("/api/users", async (request) => {
    if (!auth) return [];
    return auth.listUsers(readSessionToken(request, auth));
  });

  app.post<{
    Body: {
      username?: string;
      password?: string;
      role?: AuthRole;
    };
  }>("/api/users", async (request, reply) => {
    if (!auth) {
      reply.code(404);
      return { error: "Auth is disabled." };
    }

    reply.code(201);
    return auth.createUser(
      readSessionToken(request, auth),
      String(request.body?.username || ""),
      String(request.body?.password || ""),
      request.body?.role === "admin" ? "admin" : "member"
    );
  });
}

function readSessionToken(request: FastifyRequest, auth: AuthService) {
  return readCookie(request.headers.cookie, auth.cookieName);
}
