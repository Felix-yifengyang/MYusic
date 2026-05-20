import fs from "node:fs";
import path from "node:path";
import type { CookieFileStatus } from "@myusic/shared";
import type { ApiConfig } from "./config";

export function getBilibiliCookiePath(config: ApiConfig) {
  if (config.cookies.bilibili) return path.resolve(config.cookies.bilibili);
  return path.join(path.dirname(path.dirname(config.configPath)), "cookies", "bilibili.txt");
}

export function getCookieFileStatus(filePath: string): CookieFileStatus {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      path: filePath,
      exists: false,
      size: 0
    };
  }

  const stat = fs.statSync(filePath);
  return {
    path: filePath,
    exists: true,
    size: stat.size,
    updatedAt: stat.mtime.toISOString()
  };
}

export function normalizeCookieText(value: string) {
  const normalized = value.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  return normalized ? `${normalized}\n` : "";
}

export function validateBilibiliCookieContent(content: string) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const cookieLines = lines.filter((line) => !line.startsWith("#"));

  if (!cookieLines.length) return "Cookie 内容为空。";
  if (!cookieLines.some((line) => line.includes("bilibili.com"))) return "Cookie 内容中没有 bilibili.com 域名。";
  if (!cookieLines.some((line) => line.split("\t").length >= 7)) return "Cookie 内容不是 yt-dlp 可读取的 Netscape cookies.txt 格式。";
  return "";
}
