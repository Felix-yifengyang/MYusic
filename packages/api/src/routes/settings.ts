import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { AppSettings, BilibiliCookieSaveResult, CookieFileStatus } from "@myusic/shared";
import type { ApiConfig } from "../config";
import { saveApiConfig } from "../config";
import {
  getBilibiliCookiePath,
  getCookieFileStatus,
  normalizeCookieText,
  validateBilibiliCookieContent
} from "../cookies";
import { getDiagnostics } from "../diagnostics";
import { getSettings, updateSettings } from "../settings";

export function registerSettingsRoutes(app: FastifyInstance, config: ApiConfig, authEnabled: boolean) {
  app.addHook("preHandler", async (request, reply) => {
    const path = request.url.split("?")[0];
    if (!path.startsWith("/api/settings") && !path.startsWith("/api/cookies") && path !== "/api/diagnostics") return;
    if (!authEnabled) return;
    if (!request.auth) {
      reply.code(401).send({ error: "请先登录。" });
      return;
    }
    if (request.auth?.user.role === "admin") return;
    reply.code(403).send({ error: "需要管理员权限。" });
  });

  app.get("/api/settings", async () => getSettings(config));

  app.patch<{ Body: Partial<AppSettings> }>("/api/settings", async (request) => updateSettings(config, request.body || {}));

  app.get("/api/cookies/bilibili", async (): Promise<CookieFileStatus> => {
    return getCookieFileStatus(getBilibiliCookiePath(config));
  });

  app.post<{ Body: { content?: string } }>("/api/cookies/bilibili", async (request, reply): Promise<BilibiliCookieSaveResult | { error: string }> => {
    const normalized = normalizeCookieText(String(request.body?.content || ""));
    const validationError = validateBilibiliCookieContent(normalized);
    if (validationError) {
      reply.code(400);
      return { error: validationError };
    }

    const targetPath = getBilibiliCookiePath(config);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, normalized, "utf8");
    config.cookies = { ...config.cookies, bilibili: targetPath };
    saveApiConfig(config);

    const status = getCookieFileStatus(targetPath);
    return {
      path: status.path,
      size: status.size,
      updatedAt: status.updatedAt,
      settings: getSettings(config)
    };
  });

  app.delete("/api/cookies/bilibili", async (): Promise<CookieFileStatus> => {
    const targetPath = getBilibiliCookiePath(config);
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { force: true });
    }
    config.cookies = { ...config.cookies, bilibili: targetPath };
    saveApiConfig(config);
    return getCookieFileStatus(targetPath);
  });

  app.get("/api/diagnostics", async () => getDiagnostics(config));
}
