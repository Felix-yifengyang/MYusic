import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export function registerStaticRoutes(app: FastifyInstance, webDir: string) {
  app.get("/*", async (request, reply) => {
    await serveStaticFile(request, reply, webDir);
  });
}

async function serveStaticFile(request: FastifyRequest, reply: FastifyReply, webDir: string) {
  const rawPath = new URL(request.url, "http://localhost").pathname;
  const requested = rawPath === "/" ? "/index.html" : decodeURIComponent(rawPath);
  const filePath = path.normalize(path.join(webDir, requested));

  if (!filePath.startsWith(webDir)) {
    reply.code(403).send("Forbidden");
    return;
  }

  const requestedFileExists = fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  const target = requestedFileExists
    ? filePath
    : path.join(webDir, "index.html");

  if (!fs.existsSync(target)) {
    reply.code(404).send("Web console has not been built. Run pnpm build first.");
    return;
  }

  const stat = fs.statSync(target);
  const etag = `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
  const immutableAsset = requestedFileExists && rawPath.startsWith("/static/");
  reply.header("cache-control", immutableAsset ? "public, max-age=31536000, immutable" : "no-cache");
  reply.header("etag", etag);
  reply.header("last-modified", stat.mtime.toUTCString());

  if (request.headers["if-none-match"] === etag) {
    reply.code(304).send();
    return;
  }

  reply.type(contentType(target)).send(fs.readFileSync(target));
}

function contentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".ttf") return "font/ttf";
  if (ext === ".woff2") return "font/woff2";
  return "application/octet-stream";
}
