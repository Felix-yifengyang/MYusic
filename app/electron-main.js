const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow, shell, ipcMain, clipboard } = require("electron");
const { createRuntime } = require("./runtime");

function logFilePath() {
  if (process.env.PERSONAL_MUSIC_DATA_DIR) {
    return path.join(process.env.PERSONAL_MUSIC_DATA_DIR, "app.log");
  }

  const devDataDir = path.resolve(__dirname, "..", "..", "personal-music-stack-data");
  if (!app.isPackaged) {
    return path.join(devDataDir, "app.log");
  }

  if (process.resourcesPath && process.resourcesPath.includes(`${path.sep}release${path.sep}win-unpacked${path.sep}resources`)) {
    return path.join(
      path.resolve(process.resourcesPath, "..", "..", "..", "..", "personal-music-stack-data"),
      "app.log"
    );
  }

  return path.join(devDataDir, "app.log");
}

function writeLog(level, message) {
  const target = logFilePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.appendFileSync(target, `${new Date().toISOString()} ${level}${message}\n`, "utf8");
}

const logger = {
  log(message) {
    writeLog("", message);
  },
  error(message) {
    writeLog("ERROR ", message);
  }
};
const runtime = createRuntime({ logger });
let mainWindow;
let runtimeStatus = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 860,
    minHeight: 620,
    title: "Personal Music",
    backgroundColor: "#111417",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, "loading.html"));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(async () => {
  createWindow();

  try {
    logger.log("Electron app starting runtime");
    runtimeStatus = await runtime.start();
    logger.log(`Runtime status: ${JSON.stringify(runtimeStatus)}`);
    if (runtimeStatus.collectorReady) {
      await mainWindow.loadFile(path.join(__dirname, "shell.html"));
      return;
    }

    await mainWindow.loadFile(path.join(__dirname, "loading.html"), {
      query: { error: "collector" }
    });
  } catch (error) {
    logger.error(error.stack || error.message);
    await mainWindow.loadFile(path.join(__dirname, "loading.html"), {
      query: { error: encodeURIComponent(error.message) }
    });
  }
});

app.on("window-all-closed", () => {
  runtime.stop();
  app.quit();
});

app.on("before-quit", () => {
  runtime.stop();
});

function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }

  return addresses;
}

function statusPayload() {
  const paths = runtime.paths;
  const lanAddresses = getLanAddresses();
  const firstLan = lanAddresses[0] || "127.0.0.1";

  return {
    collectorReady: Boolean(runtimeStatus?.collectorReady),
    navidromeReady: Boolean(runtimeStatus?.navidromeReady),
    collectorUrl: runtimeStatus?.collectorUrl || "http://127.0.0.1:8787",
    navidromeUrl: runtimeStatus?.navidromeUrl || "http://127.0.0.1:4533",
    iphoneUrl: `http://${firstLan}:4533`,
    lanAddresses,
    paths: {
      rootDir: paths.rootDir,
      dataRootDir: paths.dataRootDir,
      libraryDir: paths.libraryDir,
      cookiesDir: paths.cookiesDir,
      bilibiliCookiesPath: paths.bilibiliCookiesPath,
      logPath: logFilePath()
    },
    exists: {
      dataRootDir: fs.existsSync(paths.dataRootDir),
      libraryDir: fs.existsSync(paths.libraryDir),
      bilibiliCookies: fs.existsSync(paths.bilibiliCookiesPath),
      logFile: fs.existsSync(logFilePath())
    }
  };
}

ipcMain.handle("app:getStatus", async () => statusPayload());

ipcMain.handle("app:openPath", async (_event, target) => {
  const allowed = statusPayload().paths;
  const targetPath = allowed[target];
  if (!targetPath) {
    throw new Error(`Unknown path target: ${target}`);
  }

  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(path.extname(targetPath) ? path.dirname(targetPath) : targetPath, { recursive: true });
  }

  await shell.openPath(targetPath);
  return true;
});

ipcMain.handle("app:copyText", async (_event, text) => {
  clipboard.writeText(String(text || ""));
  return true;
});
