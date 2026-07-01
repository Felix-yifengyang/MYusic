import type { FastifyInstance } from "fastify";
import type { ApiConfig } from "../config";
import {
  getNavidromeSong,
  getNavidromeSongs,
  pingNavidrome,
  proxyNavidromeCover,
  proxyNavidromeStream
} from "../navidrome";
import { getUserLibraryContext } from "../services/user-library-service";

export function registerNavidromeRoutes(app: FastifyInstance, config: ApiConfig) {
  app.get("/api/navidrome/ping", async (request) => {
    const context = request.auth?.user ? getUserLibraryContext(config, request.auth.user).navidrome : undefined;
    return pingNavidrome(config, context);
  });

  app.get<{ Querystring: { q?: string } }>("/api/navidrome/songs", async (request) => {
    const context = request.auth?.user ? getUserLibraryContext(config, request.auth.user).navidrome : undefined;
    return getNavidromeSongs(config, request.query.q || "", context);
  });

  app.get<{ Params: { id: string } }>("/api/navidrome/stream/:id", async (request, reply) => {
    const context = request.auth?.user ? getUserLibraryContext(config, request.auth.user).navidrome : undefined;
    if (!(await canAccessSong(config, request.params.id, context))) {
      reply.code(404);
      return { error: "Song not found." };
    }
    await proxyNavidromeStream(config, request, reply, context);
  });

  app.get<{ Params: { id: string } }>("/api/navidrome/cover/:id", async (request, reply) => {
    const context = request.auth?.user ? getUserLibraryContext(config, request.auth.user).navidrome : undefined;
    if (!(await canAccessSong(config, request.params.id, context))) {
      reply.code(404);
      return { error: "Song not found." };
    }
    await proxyNavidromeCover(config, request, reply, context);
  });
}

async function canAccessSong(config: ApiConfig, songId: string, context: ReturnType<typeof getUserLibraryContext>["navidrome"] | undefined) {
  if (!context?.libraryId && !context?.pathPrefix) return true;
  return Boolean(await getNavidromeSong(config, songId, context));
}
