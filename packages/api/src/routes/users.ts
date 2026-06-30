import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuthRole } from "@myusic/shared";
import type { AuthService } from "../auth";
import { readCookie } from "../auth";
import type { ApiConfig } from "../config";
import { provisionNavidromeUserLibrary } from "../services/navidrome-admin-service";

export function registerUserRoutes(app: FastifyInstance, auth: AuthService | undefined, config: ApiConfig) {
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
      request.body?.role === "admin" ? "admin" : "member",
      {
        provisionNavidrome: (user) => provisionUserNavidrome(config, user)
      }
    );
  });

  app.post<{
    Params: {
      id: string;
    };
    Body: {
      password?: string;
    };
  }>("/api/users/:id/navidrome", async (request) => {
    if (!auth) return { error: "Auth is disabled." };

    return auth.provisionUserNavidrome(
      readSessionToken(request, auth),
      request.params.id,
      String(request.body?.password || ""),
      {
        provisionNavidrome: (user) => provisionUserNavidrome(config, user)
      }
    );
  });
}

function readSessionToken(request: FastifyRequest, auth: AuthService) {
  return readCookie(request.headers.cookie, auth.cookieName);
}

async function provisionUserNavidrome(
  config: ApiConfig,
  user: {
    id: string;
    username: string;
    password: string;
    role: AuthRole;
  }
) {
  const result = await provisionNavidromeUserLibrary(config, {
    userId: user.id,
    username: user.username,
    password: user.password,
    isAdmin: user.role === "admin"
  });
  return {
    navidromeUserId: result.userId,
    navidromeLibraryId: result.libraryId
  };
}
