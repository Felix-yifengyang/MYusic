import fs from "node:fs";
import path from "node:path";

export interface DownloadConfig {
  musicDir: string;
  audioFormat: string;
  audioQuality: string;
  ffmpegPath?: string;
  cookies?: {
    bilibili?: string;
  };
}

export interface DownloadArgsResult {
  args: string[];
  notes: string[];
}

export function createAudioDownloadArgs(url: string, config: DownloadConfig): DownloadArgsResult {
  const outputTemplate = path.join(
    config.musicDir,
    "%(uploader,creator,artist|Unknown)s",
    "%(title).200B.%(ext)s"
  );

  const args = [
    "--no-playlist",
    "-x",
    "--audio-format",
    config.audioFormat,
    "--audio-quality",
    config.audioQuality,
    "--embed-thumbnail",
    "--add-metadata",
    "-o",
    outputTemplate,
    url
  ];
  const notes: string[] = [];

  const bilibiliCookies = config.cookies?.bilibili;
  if (/^https?:\/\/([^/]+\.)?bilibili\.com\//i.test(url) && bilibiliCookies && fs.existsSync(bilibiliCookies)) {
    args.unshift("--cookies", bilibiliCookies);
    notes.push(`Using Bilibili cookies: ${bilibiliCookies}`);
  }

  if (config.ffmpegPath) {
    args.unshift("--ffmpeg-location", config.ffmpegPath);
  }

  return { args, notes };
}

export function decodeProcessOutput(value: Buffer): string {
  const utf8 = value.toString("utf8");
  if (!utf8.includes("\uFFFD")) {
    return utf8;
  }

  return new TextDecoder("gbk").decode(value);
}
