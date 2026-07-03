import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { ApiConfig } from "../config";
import {
  getNavidromeSong,
  getNavidromeSongs,
  pingNavidrome,
  proxyNavidromeCover,
  proxyNavidromeStream,
  getNavidromeScanStatus,
  startNavidromeScan
} from "../navidrome";
import { getUserMusicDir } from "../services/download-service";
import { getUserNavidromeContext } from "../services/user-library-service";

export interface RegisterNavidromeRoutesOptions {
  config: ApiConfig;
}

export function registerNavidromeRoutes(app: FastifyInstance, options: RegisterNavidromeRoutesOptions) {
  const { config } = options;

  app.get("/api/navidrome/ping", async (request) => {
    const context = getUserNavidromeContext(config, request.auth?.user);
    return pingNavidrome(config, context);
  });

  app.get<{ Querystring: { q?: string } }>("/api/navidrome/songs", async (request) => {
    const context = getUserNavidromeContext(config, request.auth?.user);
    return getNavidromeSongs(config, request.query.q || "", context);
  });

  app.get<{ Params: { id: string } }>("/api/navidrome/stream/:id", async (request, reply) => {
    const context = getUserNavidromeContext(config, request.auth?.user);
    if (!(await canAccessSong(config, request.params.id, context))) {
      reply.code(404);
      return { error: "Song not found." };
    }
    await proxyNavidromeStream(config, request, reply, context);
  });

  app.get<{ Params: { id: string }; Querystring: { songId?: string } }>("/api/navidrome/cover/:id", async (request, reply) => {
    const context = getUserNavidromeContext(config, request.auth?.user);
    if (!(await canAccessSong(config, request.query.songId || request.params.id, context))) {
      reply.code(404);
      return { error: "Song not found." };
    }
    await proxyNavidromeCover(config, request, reply, context);
  });

  app.delete<{ Params: { id: string } }>("/api/navidrome/songs/:id", async (request, reply) => {
    const context = getUserNavidromeContext(config, request.auth?.user);
    const song = await getNavidromeSong(config, request.params.id, context);
    if (!song) {
      reply.code(404);
      return { error: "Song not found." };
    }

    const songPathParts = (song.path || "").replace(/\\/g, "/").split("/").filter(Boolean);
    const relativeSongPath = songPathParts.length >= 3
      ? [songPathParts[0], ...songPathParts.slice(2)]
      : songPathParts;
    const libraryRoot = path.resolve(getUserMusicDir(config, request.auth?.user.id));
    const filePath = path.resolve(libraryRoot, ...relativeSongPath);
    const relativePath = filePath ? path.relative(libraryRoot, filePath) : "";
    if (!relativeSongPath.length || relativePath.startsWith("..") || path.isAbsolute(relativePath) || !fs.existsSync(filePath)) {
      reply.code(409);
      return { error: "Cannot locate this song in the local music library." };
    }

    await fs.promises.unlink(filePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return;
      throw error;
    });
    await startNavidromeScan(config, context);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await delay(1500);
      const status = await getNavidromeScanStatus(config, context);
      if (!status.scanning) break;
    }

    return { ok: true };
  });
}

async function canAccessSong(config: ApiConfig, songId: string, context: ReturnType<typeof getUserNavidromeContext>) {
  if (context && !context.libraryId) return false;
  if (!context) return true;
  return Boolean(await getNavidromeSong(config, songId, context));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
