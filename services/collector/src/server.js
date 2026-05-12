const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const configPath = path.join(rootDir, "config.json");
const config = loadConfig();
const jobs = [];

function loadConfig() {
  const raw = fs.readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw);
  return {
    host: parsed.host || "0.0.0.0",
    port: Number(parsed.port || 8787),
    musicDir: parsed.musicDir || path.join(rootDir, "music"),
    ytdlpPath: parsed.ytdlpPath || "yt-dlp",
    audioFormat: parsed.audioFormat || "mp3",
    audioQuality: String(parsed.audioQuality ?? "0"),
    ffmpegPath: parsed.ffmpegPath || "",
    cookies: parsed.cookies || {},
    maxJobs: Number(parsed.maxJobs || 50)
  };
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(data)
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 64) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function serveFile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(publicDir, requested));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "content-type": contentType(filePath) });
    res.end(data);
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function decodeProcessOutput(value) {
  const utf8 = value.toString("utf8");
  if (!utf8.includes("\uFFFD")) {
    return utf8;
  }

  return new TextDecoder("gbk").decode(value);
}

function appendOutput(job, value) {
  job.output += decodeProcessOutput(value);
  if (job.output.length > 30000) {
    job.output = job.output.slice(-30000);
  }
}

function startDownload(url) {
  fs.mkdirSync(config.musicDir, { recursive: true });

  const job = {
    id: crypto.randomUUID(),
    url,
    status: "running",
    output: "",
    createdAt: new Date().toISOString()
  };

  jobs.push(job);
  while (jobs.length > config.maxJobs) jobs.shift();

  const outputTemplate = path.join(config.musicDir, "%(uploader,creator,artist|Unknown)s", "%(title).200B.%(ext)s");
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

  const bilibiliCookies = config.cookies.bilibili;
  if (/^https?:\/\/([^/]+\.)?bilibili\.com\//i.test(url) && bilibiliCookies && fs.existsSync(bilibiliCookies)) {
    args.unshift("--cookies", bilibiliCookies);
    job.output += `Using Bilibili cookies: ${bilibiliCookies}\n`;
  }

  if (config.ffmpegPath) {
    args.unshift("--ffmpeg-location", config.ffmpegPath);
  }

  const child = spawn(config.ytdlpPath, args, {
    windowsHide: true,
    shell: false
  });

  child.stdout.on("data", (data) => appendOutput(job, data));
  child.stderr.on("data", (data) => appendOutput(job, data));
  child.on("error", (error) => {
    job.status = "failed";
    job.error = error.message;
    job.finishedAt = new Date().toISOString();
  });
  child.on("close", (code) => {
    if (job.status !== "failed") {
      job.status = code === 0 ? "done" : "failed";
    }
    job.exitCode = code;
    job.finishedAt = new Date().toISOString();
  });

  return job;
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    json(res, 200, { ok: true, musicDir: config.musicDir });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/jobs") {
    json(res, 200, jobs.slice().reverse());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/download") {
    try {
      const body = JSON.parse(await readBody(req));
      const mediaUrl = String(body.url || "").trim();

      if (!/^https?:\/\//i.test(mediaUrl)) {
        json(res, 400, { error: "Please provide a valid http(s) URL." });
        return;
      }

      const job = startDownload(mediaUrl);
      json(res, 202, job);
    } catch (error) {
      json(res, 400, { error: error.message });
    }
    return;
  }

  json(res, 404, { error: "Not found" });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res).catch((error) => json(res, 500, { error: error.message }));
    return;
  }

  serveFile(req, res);
});

server.listen(config.port, config.host, () => {
  console.log(`Music Collector running at http://127.0.0.1:${config.port}`);
  console.log(`Music directory: ${config.musicDir}`);
});

