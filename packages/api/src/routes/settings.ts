import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { AppSettings, BilibiliCookieSaveResult } from "@personal-music/shared";
import type { ApiConfig } from "../config";
import { saveApiConfig } from "../config";
import { getDiagnostics } from "../diagnostics";
import { getSettings, updateSettings } from "../settings";

export function registerSettingsRoutes(app: FastifyInstance, config: ApiConfig) {
  app.get("/api/settings", async () => getSettings(config));

  app.patch<{ Body: Partial<AppSettings> }>("/api/settings", async (request) => updateSettings(config, request.body || {}));

  app.post<{ Body: { content?: string } }>("/api/cookies/bilibili", async (request, reply): Promise<BilibiliCookieSaveResult | { error: string }> => {
    const normalized = normalizeCookieText(String(request.body?.content || ""));
    const validationError = validateBilibiliCookieContent(normalized);
    if (validationError) {
      reply.code(400);
      return { error: validationError };
    }

    const targetPath = resolveBilibiliCookiePath(config);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, normalized, "utf8");
    config.cookies = { ...config.cookies, bilibili: targetPath };
    saveApiConfig(config);

    return {
      path: targetPath,
      size: Buffer.byteLength(normalized, "utf8"),
      settings: getSettings(config)
    };
  });

  app.get("/api/diagnostics", async () => getDiagnostics(config));
}

function resolveBilibiliCookiePath(config: ApiConfig) {
  if (config.cookies.bilibili) return path.resolve(config.cookies.bilibili);
  return path.join(path.dirname(path.dirname(config.configPath)), "cookies", "bilibili.txt");
}

function normalizeCookieText(value: string) {
  const normalized = value.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  return normalized ? `${normalized}\n` : "";
}

function validateBilibiliCookieContent(content: string) {
  const lines = content.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const cookieLines = lines.filter((line) => !line.startsWith("#"));

  if (!cookieLines.length) return "Cookie 内容为空。";
  if (!cookieLines.some((line) => line.includes("bilibili.com"))) return "Cookie 内容中没有 bilibili.com 域名。";
  if (!cookieLines.some((line) => line.split("\t").length >= 7)) return "Cookie 内容不是 yt-dlp 可读取的 Netscape cookies.txt 格式。";
  return "";
}
