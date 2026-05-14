import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { DiagnosticCheck, DiagnosticsReport } from "@personal-music/shared";
import type { ApiConfig } from "./config";
import { pingNavidrome } from "./navidrome";

export async function getDiagnostics(config: ApiConfig): Promise<DiagnosticsReport> {
  const checks: DiagnosticCheck[] = [
    fileCheck("yt-dlp", "yt-dlp", config.ytdlpPath, "运行 .\\scripts\\setup-windows.ps1 或在设置中填写正确的 yt-dlp 路径。"),
    optionalFileCheck("ffmpeg", "ffmpeg", config.ffmpegPath, "运行 .\\scripts\\setup-windows.ps1 或在设置中填写正确的 ffmpeg 路径。"),
    directoryWritableCheck("musicDir", "音乐目录", config.musicDir, "检查音乐目录是否存在，以及当前用户是否有写入权限。"),
    fileParentWritableCheck("jobStore", "任务记录", config.jobStorePath, "检查 jobs.json 所在目录是否可写。"),
    fileParentWritableCheck("ingestionStore", "入库记录", config.ingestionStorePath, "检查 ingestions.json 所在目录是否可写。"),
    bilibiliCookieCheck(config.cookies.bilibili || "")
  ];

  checks.push(await navidromeCheck(config));

  return {
    ok: checks.every((check) => check.level !== "error"),
    checks
  };
}

export function getBlockingDownloadChecks(config: ApiConfig): DiagnosticCheck[] {
  return [
    fileCheck("yt-dlp", "yt-dlp", config.ytdlpPath, "运行 .\\scripts\\setup-windows.ps1 或在设置中填写正确的 yt-dlp 路径。"),
    directoryWritableCheck("musicDir", "音乐目录", config.musicDir, "检查音乐目录是否存在，以及当前用户是否有写入权限。")
  ].filter((check) => check.level === "error");
}

function fileCheck(id: string, label: string, filePath: string, suggestion: string): DiagnosticCheck {
  if (!filePath || !fs.existsSync(filePath)) {
    return { id, label, level: "error", message: `未找到：${filePath || "未设置"}`, suggestion };
  }

  return { id, label, level: "ok", message: filePath };
}

function optionalFileCheck(
  id: string,
  label: string,
  filePath: string,
  suggestion: string,
  missingLevel: "warning" | "error" = "error"
): DiagnosticCheck {
  if (!filePath) {
    return { id, label, level: missingLevel, message: "未设置", suggestion };
  }

  if (!fs.existsSync(filePath)) {
    return { id, label, level: missingLevel, message: `未找到：${filePath}`, suggestion };
  }

  return { id, label, level: "ok", message: filePath };
}

function bilibiliCookieCheck(filePath: string): DiagnosticCheck {
  const suggestion = "在设置中上传或粘贴从浏览器导出的 Netscape cookies.txt。";

  if (!filePath) {
    return { id: "bilibiliCookie", label: "Bilibili Cookie", level: "warning", message: "未配置", suggestion };
  }

  if (!fs.existsSync(filePath)) {
    return { id: "bilibiliCookie", label: "Bilibili Cookie", level: "warning", message: `未找到：${filePath}`, suggestion };
  }

  try {
    const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    const validationError = validateBilibiliCookieContent(content);
    if (validationError) {
      return { id: "bilibiliCookie", label: "Bilibili Cookie", level: "warning", message: validationError, suggestion };
    }
    return { id: "bilibiliCookie", label: "Bilibili Cookie", level: "ok", message: filePath };
  } catch (error) {
    return {
      id: "bilibiliCookie",
      label: "Bilibili Cookie",
      level: "warning",
      message: error instanceof Error ? error.message : "无法读取 Cookie 文件",
      suggestion
    };
  }
}

function validateBilibiliCookieContent(content: string) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const cookieLines = lines.filter((line) => !line.startsWith("#"));

  if (!cookieLines.length) return "Cookie 文件为空。";
  if (!cookieLines.some((line) => line.includes("bilibili.com"))) return "Cookie 中没有 bilibili.com 域名。";
  if (!cookieLines.some((line) => line.split("\t").length >= 7)) return "Cookie 文件不是 yt-dlp 可读取的 Netscape cookies.txt 格式。";
  return "";
}

function directoryWritableCheck(id: string, label: string, dirPath: string, suggestion: string): DiagnosticCheck {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    const probe = path.join(dirPath, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, "ok", "utf8");
    try {
      fs.unlinkSync(probe);
    } catch {
      setTimeout(() => fs.rm(probe, { force: true }, () => undefined), 1000);
    }
    return { id, label, level: "ok", message: dirPath };
  } catch (error) {
    return {
      id,
      label,
      level: "error",
      message: error instanceof Error ? error.message : "不可写",
      suggestion
    };
  }
}

function fileParentWritableCheck(id: string, label: string, filePath: string, suggestion: string): DiagnosticCheck {
  return directoryWritableCheck(id, label, path.dirname(filePath), suggestion);
}

function navidromeCheck(config: ApiConfig): Promise<DiagnosticCheck> {
  const baseUrl = config.navidrome.baseUrl || "http://127.0.0.1:4533";

  if (!config.navidrome.username || !config.navidrome.password) {
    return Promise.resolve({
      id: "navidromeAuth",
      label: "Navidrome API",
      level: "warning",
      message: "未配置 Navidrome 用户名或密码",
      suggestion: "在设置中填写 Navidrome 账号密码后，才能在本页面搜索和播放 Navidrome 音乐库。"
    });
  }

  return pingNavidrome(config).then(() => ({
    id: "navidromeAuth",
    label: "Navidrome API",
    level: "ok" as const,
    message: "Subsonic API 可用"
  })).catch(() => new Promise<DiagnosticCheck>((resolve) => {
    const request = http.get(baseUrl, { timeout: 1500 }, (response) => {
      response.resume();
      resolve({
        id: "navidromeAuth",
        label: "Navidrome API",
        level: "warning",
        message: `${baseUrl} 可访问，但 Subsonic API 登录失败`,
        suggestion: "检查设置中的 Navidrome 用户名和密码。"
      });
    });

    request.on("timeout", () => {
      request.destroy();
      resolve({
        id: "navidromeAuth",
        label: "Navidrome API",
        level: "warning",
        message: `${baseUrl} 没有响应`,
        suggestion: "检查 Navidrome 是否启动。"
      });
    });
    request.on("error", (error) => {
      resolve({
        id: "navidromeAuth",
        label: "Navidrome API",
        level: "warning",
        message: error.message,
        suggestion: "检查 Navidrome 是否启动，或确认设置中的地址是否正确。"
      });
    });
  }));
}
