import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { DiagnosticCheck, DiagnosticsReport } from "@personal-music/shared";
import type { ApiConfig } from "./config";

export async function getDiagnostics(config: ApiConfig): Promise<DiagnosticsReport> {
  const checks: DiagnosticCheck[] = [
    fileCheck("yt-dlp", "yt-dlp", config.ytdlpPath, "运行 .\\scripts\\setup-windows.ps1 或在设置中填写正确的 yt-dlp 路径。"),
    optionalFileCheck("ffmpeg", "ffmpeg", config.ffmpegPath, "运行 .\\scripts\\setup-windows.ps1 或在设置中填写正确的 ffmpeg 路径。"),
    directoryWritableCheck("musicDir", "音乐目录", config.musicDir, "检查音乐目录是否存在，以及当前用户是否有写入权限。"),
    fileParentWritableCheck("jobStore", "任务记录", config.jobStorePath, "检查 jobs.json 所在目录是否可写。"),
    optionalFileCheck("bilibiliCookie", "Bilibili Cookie", config.cookies.bilibili || "", "导出 cookies.txt 并在设置中填写路径。", "warning")
  ];

  checks.push(await navidromeCheck(config.navidrome.baseUrl || "http://127.0.0.1:4533"));

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

function directoryWritableCheck(id: string, label: string, dirPath: string, suggestion: string): DiagnosticCheck {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    const probe = path.join(dirPath, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
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

function navidromeCheck(baseUrl: string): Promise<DiagnosticCheck> {
  return new Promise((resolve) => {
    const request = http.get(baseUrl, { timeout: 1500 }, (response) => {
      response.resume();
      resolve({ id: "navidrome", label: "Navidrome", level: "ok", message: `${baseUrl} responded with ${response.statusCode}` });
    });

    request.on("timeout", () => {
      request.destroy();
      resolve({
        id: "navidrome",
        label: "Navidrome",
        level: "warning",
        message: `${baseUrl} 没有响应`,
        suggestion: "如果需要 iPhone/Amperfy 播放，检查 Navidrome 是否启动。"
      });
    });
    request.on("error", (error) => {
      resolve({
        id: "navidrome",
        label: "Navidrome",
        level: "warning",
        message: error.message,
        suggestion: "如果需要 iPhone/Amperfy 播放，检查 Navidrome 是否启动。"
      });
    });
  });
}
