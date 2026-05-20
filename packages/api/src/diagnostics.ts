import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { Pool } from "pg";
import type { DiagnosticCheck, DiagnosticsReport } from "@myusic/shared";
import type { ApiConfig } from "./config";
import { getCookieFileStatus, validateBilibiliCookieContent } from "./cookies";
import { pingNavidrome } from "./navidrome";

export async function getDiagnostics(config: ApiConfig): Promise<DiagnosticsReport> {
  const checks: DiagnosticCheck[] = [
    storageModeCheck(config),
    fileCheck("yt-dlp", "yt-dlp", config.ytdlpPath, "运行 .\\scripts\\setup-windows.ps1，或在设置中填写正确的 yt-dlp 路径。"),
    optionalFileCheck("ffmpeg", "ffmpeg", config.ffmpegPath, "运行 .\\scripts\\setup-windows.ps1，或在设置中填写正确的 ffmpeg 路径。"),
    directoryWritableCheck("musicDir", "音乐目录", config.musicDir, "检查音乐目录是否存在，以及当前用户是否有写入权限。"),
    bilibiliCookieCheck(config.cookies.bilibili || "")
  ];

  if (config.database.driver === "postgres") {
    checks.push(await postgresCheck(config));
  } else {
    checks.push(
      fileParentWritableCheck("jobStore", "任务记录", config.jobStorePath, "检查 jobs.json 所在目录是否可写。"),
      fileParentWritableCheck("ingestionStore", "入库记录", config.ingestionStorePath, "检查 ingestions.json 所在目录是否可写。")
    );
  }

  checks.push(await navidromeCheck(config));

  return {
    ok: checks.every((check) => check.level !== "error"),
    checks
  };
}

export function getBlockingDownloadChecks(config: ApiConfig): DiagnosticCheck[] {
  return [
    fileCheck("yt-dlp", "yt-dlp", config.ytdlpPath, "运行 .\\scripts\\setup-windows.ps1，或在设置中填写正确的 yt-dlp 路径。"),
    directoryWritableCheck("musicDir", "音乐目录", config.musicDir, "检查音乐目录是否存在，以及当前用户是否有写入权限。")
  ].filter((check) => check.level === "error");
}

function storageModeCheck(config: ApiConfig): DiagnosticCheck {
  return {
    id: "storageMode",
    label: "数据存储",
    level: "ok",
    message: config.database.driver === "postgres" ? "Postgres" : "JSON 本地文件"
  };
}

async function postgresCheck(config: ApiConfig): Promise<DiagnosticCheck> {
  if (!config.database.url) {
    return {
      id: "postgres",
      label: "Postgres",
      level: "error",
      message: "未配置 DATABASE_URL",
      suggestion: "在 .env 中填写 DATABASE_URL。"
    };
  }

  const pool = new Pool({ connectionString: config.database.url });
  try {
    const result = await pool.query(`
      select
        to_regclass('public.download_jobs') is not null as has_download_jobs,
        to_regclass('public.ingestions') is not null as has_ingestions,
        case when to_regclass('public.download_jobs') is null then 0 else (select count(*) from download_jobs) end as download_jobs_count,
        case when to_regclass('public.ingestions') is null then 0 else (select count(*) from ingestions) end as ingestions_count
    `);
    const row = result.rows[0] as {
      has_download_jobs: boolean;
      has_ingestions: boolean;
      download_jobs_count: string | number;
      ingestions_count: string | number;
    };
    const hasTables = row.has_download_jobs && row.has_ingestions;

    return {
      id: "postgres",
      label: "Postgres",
      level: hasTables ? "ok" : "warning",
      message: hasTables
        ? `连接正常；download_jobs ${row.download_jobs_count} 条，ingestions ${row.ingestions_count} 条`
        : "连接正常，但表尚未完整创建",
      suggestion: hasTables ? undefined : "启动 API 后会自动创建表，或运行 pnpm migrate:json-to-postgres。"
    };
  } catch (error) {
    return {
      id: "postgres",
      label: "Postgres",
      level: "error",
      message: error instanceof Error ? error.message : "数据库连接失败",
      suggestion: "检查 .env 中 DATABASE_URL 的数据库名、用户名、密码和端口。"
    };
  } finally {
    await pool.end();
  }
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
  const status = getCookieFileStatus(filePath);

  if (!filePath) {
    return { id: "bilibiliCookie", label: "Bilibili Cookie", level: "warning", message: "未配置", suggestion };
  }

  if (!status.exists) {
    return { id: "bilibiliCookie", label: "Bilibili Cookie", level: "warning", message: `未找到：${filePath}`, suggestion };
  }

  try {
    const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    const validationError = validateBilibiliCookieContent(content);
    if (validationError) {
      return { id: "bilibiliCookie", label: "Bilibili Cookie", level: "warning", message: validationError, suggestion };
    }

    const updatedAt = status.updatedAt ? `，更新时间 ${new Date(status.updatedAt).toLocaleString("zh-CN")}` : "";
    return {
      id: "bilibiliCookie",
      label: "Bilibili Cookie",
      level: "ok",
      message: `${filePath}，${formatBytes(status.size)}${updatedAt}`
    };
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

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
