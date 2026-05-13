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

  const target = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    ? filePath
    : path.join(webDir, "index.html");

  if (!fs.existsSync(target)) {
    reply.code(404).send("Web console has not been built. Run pnpm build first.");
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
  return "application/octet-stream";
}
