import fs from "node:fs";
import { writeApiConfig } from "./config/api";
import { writeNavidromeConfig } from "./config/navidrome";
import { resolveNodeCommand } from "./node";
import { ensureRuntimeFolders, resolveRuntimePaths } from "./paths";
import { waitForPort } from "./ports";
import { ProcessManager, type RuntimeLogger } from "./process-manager";

export interface RuntimeStatus {
  apiReady: boolean;
  navidromeReady: boolean;
  webConsoleUrl: string;
  navidromeUrl: string;
  libraryDir: string;
}

export interface CreateRuntimeOptions {
  rootDir?: string;
  dataRootDir?: string;
  logger?: RuntimeLogger;
}

export function createRuntime(options: CreateRuntimeOptions = {}) {
  const paths = resolveRuntimePaths(options.rootDir, options.dataRootDir);
  const logger = options.logger || console;
  const processManager = new ProcessManager(logger);

  async function start(): Promise<RuntimeStatus> {
    ensureRuntimeFolders(paths);
    const apiConfig = writeApiConfig(paths);
    writeNavidromeConfig(paths, apiConfig.ffmpegPath, apiConfig.musicDir);

    logger.log(`Runtime root: ${paths.rootDir}`);
    logger.log(`Runtime data: ${paths.dataRootDir}`);
    logger.log(`Runtime node: ${resolveNodeCommand()}`);
    logger.log(`Runtime yt-dlp: ${fs.existsSync(paths.ytdlpExePath) ? paths.ytdlpExePath : "yt-dlp from PATH"}`);
    logger.log(`Runtime ffmpeg: ${fs.existsSync(paths.ffmpegExePath) ? paths.ffmpegExePath : "not bundled"}`);

    await processManager.startService({
      name: "api",
      port: 8787,
      url: "http://127.0.0.1:8787",
      command: resolveNodeCommand(),
      args: [paths.apiCliPath, "--config", paths.apiConfigPath],
      cwd: paths.rootDir,
      requiredFile: paths.apiCliPath
    });

    await processManager.startService({
      name: "navidrome",
      port: 4533,
      url: "http://127.0.0.1:4533",
      command: paths.navidromeExePath,
      args: ["--configfile", paths.navidromeConfigPath],
      cwd: paths.navidromeDir,
      requiredFile: paths.navidromeExePath
    });

    return {
      apiReady: await waitForPort(8787),
      navidromeReady: await waitForPort(4533),
      webConsoleUrl: "http://127.0.0.1:8787",
      navidromeUrl: "http://127.0.0.1:4533",
      libraryDir: paths.libraryDir
    };
  }

  return {
    start,
    stop: () => processManager.stop(),
    paths
  };
}
