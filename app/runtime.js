const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

function createRuntime(options = {}) {
  const rootDir = options.rootDir || resolveRootDir();
  const dataRootDir = options.dataRootDir || resolveDataRootDir(rootDir);
  const logger = options.logger || console;
  const collectorDir = path.join(rootDir, "services", "collector");
  const collectorConfigPath = path.join(collectorDir, "config.json");
  const navidromeDir = path.join(rootDir, "services", "navidrome");
  const navidromeExePath = path.join(navidromeDir, "navidrome.exe");
  const navidromeConfigPath = path.join(dataRootDir, "navidrome", "navidrome.toml");
  const libraryDir = path.join(dataRootDir, "library");
  const cookiesDir = path.join(dataRootDir, "cookies");
  const bilibiliCookiesPath = path.join(cookiesDir, "bilibili.txt");
  const binDir = path.join(rootDir, "bin");
  const nodeExePath = path.join(binDir, process.platform === "win32" ? "node.exe" : "node");
  const ytdlpExePath = path.join(binDir, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
  const ffmpegExePath = path.join(binDir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  const children = [];

  function resolveNodeCommand() {
    if (fs.existsSync(nodeExePath)) {
      return nodeExePath;
    }

    const pathValue = process.env.Path || process.env.PATH || "";
    const segments = pathValue.split(path.delimiter).filter(Boolean);

    for (const segment of segments) {
      const candidate = path.join(segment, process.platform === "win32" ? "node.exe" : "node");
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return process.platform === "win32" ? "node.exe" : "node";
  }

  function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  }

  function writeJson(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
  }

  function tomlString(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function writeNavidromeConfig() {
    const collectorConfig = syncCollectorConfig();
    const dataDir = path.join(dataRootDir, "navidrome", "data");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(libraryDir, { recursive: true });
    fs.mkdirSync(cookiesDir, { recursive: true });

    const lines = [
      `MusicFolder = "${tomlString(libraryDir)}"`,
      `DataFolder = "${tomlString(dataDir)}"`,
      collectorConfig.ffmpegPath ? `FFmpegPath = "${tomlString(collectorConfig.ffmpegPath)}"` : "",
      'Address = "0.0.0.0"',
      'Port = "4533"',
      ""
    ].filter(Boolean);

    fs.writeFileSync(navidromeConfigPath, lines.join("\n"), "utf8");
  }

  function syncCollectorConfig() {
    const collectorConfig = readJson(collectorConfigPath);
    collectorConfig.musicDir = libraryDir;

    if (fs.existsSync(ytdlpExePath)) {
      collectorConfig.ytdlpPath = ytdlpExePath;
    }

    if (fs.existsSync(ffmpegExePath)) {
      collectorConfig.ffmpegPath = ffmpegExePath;
    }

    collectorConfig.cookies = {
      ...(collectorConfig.cookies || {}),
      bilibili: bilibiliCookiesPath
    };

    writeJson(collectorConfigPath, collectorConfig);
    return collectorConfig;
  }

  function isPortOpen(port) {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.setTimeout(800);
      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.on("error", () => resolve(false));
    });
  }

  function pipeOutput(name, stream) {
    stream.on("data", (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (line.trim()) {
          logger.log(`[${name}] ${line}`);
        }
      }
    });
  }

  async function startService(service) {
    if (await isPortOpen(service.port)) {
      logger.log(`${service.name} already running at ${service.url}`);
      return;
    }

    if (service.requiredFile && !fs.existsSync(service.requiredFile)) {
      logger.log(`${service.name} not installed: ${service.requiredFile}`);
      return;
    }

    const child = spawn(service.command, service.args, {
      cwd: service.cwd,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });

    children.push(child);
    pipeOutput(service.name, child.stdout);
    pipeOutput(service.name, child.stderr);

    child.on("exit", (code) => {
      logger.log(`${service.name} exited with code ${code}`);
    });

    logger.log(`${service.name} starting at ${service.url}`);
  }

  async function waitForPort(port, timeoutMs = 30000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (await isPortOpen(port)) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
  }

  async function start() {
    writeNavidromeConfig();
    logger.log(`Runtime root: ${rootDir}`);
    logger.log(`Runtime data: ${dataRootDir}`);
    logger.log(`Runtime node: ${resolveNodeCommand()}`);
    logger.log(`Runtime yt-dlp: ${fs.existsSync(ytdlpExePath) ? ytdlpExePath : collectorConfigPath}`);
    logger.log(`Runtime ffmpeg: ${fs.existsSync(ffmpegExePath) ? ffmpegExePath : "not bundled"}`);

    await startService({
      name: "collector",
      port: 8787,
      url: "http://127.0.0.1:8787",
      command: resolveNodeCommand(),
      args: [path.join(collectorDir, "src", "server.js")],
      cwd: collectorDir
    });

    await startService({
      name: "navidrome",
      port: 4533,
      url: "http://127.0.0.1:4533",
      command: navidromeExePath,
      args: ["--configfile", navidromeConfigPath],
      cwd: navidromeDir,
      requiredFile: navidromeExePath
    });

    return {
      collectorReady: await waitForPort(8787),
      navidromeReady: await waitForPort(4533),
      collectorUrl: "http://127.0.0.1:8787",
      navidromeUrl: "http://127.0.0.1:4533",
      libraryDir
    };
  }

  function stop() {
    for (const child of children) {
      if (!child.killed) {
        child.kill();
      }
    }
    children.length = 0;
  }

  return {
    start,
    stop,
    isPortOpen,
    paths: {
      rootDir,
      dataRootDir,
      collectorDir,
      navidromeDir,
      libraryDir,
      cookiesDir,
      bilibiliCookiesPath,
      binDir,
      nodeExePath,
      ytdlpExePath,
      ffmpegExePath
    }
  };
}

module.exports = {
  createRuntime
};

function resolveRootDir() {
  const devRoot = path.resolve(__dirname, "..");
  if (fs.existsSync(path.join(devRoot, "services", "collector"))) {
    return devRoot;
  }

  if (process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, "services", "collector"))) {
    return process.resourcesPath;
  }

  return devRoot;
}

function resolveDataRootDir(rootDir) {
  if (process.env.PERSONAL_MUSIC_DATA_DIR) {
    return process.env.PERSONAL_MUSIC_DATA_DIR;
  }

  const siblingDataDir = path.resolve(rootDir, "..", "personal-music-stack-data");
  if (rootDir.includes(`${path.sep}release${path.sep}win-unpacked${path.sep}resources`)) {
    return path.resolve(rootDir, "..", "..", "..", "..", "personal-music-stack-data");
  }

  if (!process.resourcesPath || rootDir !== process.resourcesPath) {
    return siblingDataDir;
  }

  return siblingDataDir;
}
