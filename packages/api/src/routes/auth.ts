import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AuthLoginResult, AuthStatus } from "@personal-music/shared";
import { AuthError, type AuthService, readCookie } from "../auth";

export function registerAuthRoutes(app: FastifyInstance, auth: AuthService | undefined) {
  app.get("/api/auth/status", async (request): Promise<AuthStatus> => {
    if (!auth) {
      return {
        enabled: false,
        setupRequired: false,
        authenticated: true
      };
    }

    return auth.getStatus(readSessionToken(request, auth));
  });

  app.post<{ Body: { username?: string; password?: string } }>("/api/auth/setup", async (request, reply) => {
    if (!auth) return { enabled: false };
    return handleAuthResult(reply, auth, () => auth.setupAdmin(String(request.body?.username || ""), String(request.body?.password || "")));
  });

  app.post<{ Body: { username?: string; password?: string } }>("/api/auth/login", async (request, reply) => {
    if (!auth) return { enabled: false };
    return handleAuthResult(reply, auth, () => auth.login(String(request.body?.username || ""), String(request.body?.password || "")));
  });

  app.post("/api/auth/logout", async (request, reply) => {
    if (!auth) return { ok: true };
    await auth.logout(readSessionToken(request, auth));
    reply.header("set-cookie", auth.buildClearCookie());
    return { ok: true };
  });
}

export function registerAuthGuard(app: FastifyInstance, auth: AuthService | undefined) {
  if (!auth) return;

  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0];
    if (!path.startsWith("/api/")) return;
    if (isPublicAuthPath(path)) return;

    const token = readSessionToken(request, auth);
    const session = token ? await auth.authenticate(token) : undefined;
    if (!session) {
      reply.code(401).send({ error: "请先登录。" });
    }
  });
}

function isPublicAuthPath(path: string) {
  return path === "/api/auth/status" || path === "/api/auth/setup" || path === "/api/auth/login";
}

async function handleAuthResult(
  reply: FastifyReply,
  auth: AuthService,
  callback: () => Promise<AuthLoginResult & { token: string }>
) {
  try {
    const result = await callback();
    reply.header("set-cookie", auth.buildSessionCookie(result.token, result.expiresAt));
    return {
      user: result.user,
      expiresAt: result.expiresAt
    };
  } catch (error) {
    const statusCode = error instanceof AuthError ? error.statusCode : 500;
    reply.code(statusCode);
    return { error: error instanceof Error ? error.message : "登录失败。" };
  }
}

function readSessionToken(request: FastifyRequest, auth: AuthService) {
  return readCookie(request.headers.cookie, auth.cookieName);
}
