const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, shell } = require("electron");
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 860,
    minHeight: 620,
    title: "Personal Music",
    backgroundColor: "#111417",
    webPreferences: {
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
    const status = await runtime.start();
    logger.log(`Runtime status: ${JSON.stringify(status)}`);
    if (status.collectorReady) {
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
