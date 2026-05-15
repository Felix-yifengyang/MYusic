import fs from "node:fs";
import { writeApiConfig } from "./config/api";
import { writeNavidromeConfig } from "./config/navidrome";
import { loadRuntimeEnv } from "./env";
import { resolveNodeCommand } from "./node";
import { ensureRuntimeFolders, resolveRuntimePaths, resolveRuntimeRootDir } from "./paths";
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
  const rootDir = options.rootDir || resolveRuntimeRootDir();
  loadRuntimeEnv(rootDir);
  const paths = resolveRuntimePaths(rootDir, options.dataRootDir);
  const logger = options.logger || console;
  const processManager = new ProcessManager(logger);

  async function start(): Promise<RuntimeStatus> {
    ensureRuntimeFolders(paths);
    const apiConfig = writeApiConfig(paths);
    const navidromeConfig = writeNavidromeConfig(paths, apiConfig.ffmpegPath, apiConfig.musicDir);
    const webConsoleUrl = localUrl(apiConfig.port);
    const navidromeUrl = apiConfig.navidrome.baseUrl || localUrl(navidromeConfig.port);

    logger.log(`Runtime root: ${paths.rootDir}`);
    logger.log(`Runtime data: ${paths.dataRootDir}`);
    logger.log(`Runtime node: ${resolveNodeCommand()}`);
    logger.log(`Runtime yt-dlp: ${fs.existsSync(paths.ytdlpExePath) ? paths.ytdlpExePath : "yt-dlp from PATH"}`);
    logger.log(`Runtime ffmpeg: ${fs.existsSync(paths.ffmpegExePath) ? paths.ffmpegExePath : "not bundled"}`);

    await processManager.startService({
      name: "api",
      port: apiConfig.port,
      url: webConsoleUrl,
      command: resolveNodeCommand(),
      args: [paths.apiCliPath, "--config", paths.apiConfigPath],
      cwd: paths.rootDir,
      requiredFile: paths.apiCliPath
    });

    await processManager.startService({
      name: "navidrome",
      port: navidromeConfig.port,
      url: navidromeUrl,
      command: paths.navidromeExePath,
      args: ["--configfile", paths.navidromeConfigPath],
      cwd: paths.navidromeDir,
      requiredFile: paths.navidromeExePath
    });

    return {
      apiReady: await waitForPort(apiConfig.port),
      navidromeReady: await waitForPort(navidromeConfig.port),
      webConsoleUrl,
      navidromeUrl,
      libraryDir: paths.libraryDir
    };
  }

  return {
    start,
    stop: () => processManager.stop(),
    paths
  };
}

function localUrl(port: number) {
  return `http://127.0.0.1:${port}`;
}
