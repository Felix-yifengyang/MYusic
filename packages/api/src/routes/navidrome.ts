import type { FastifyInstance } from "fastify";
import type { ApiConfig } from "../config";
import {
  getNavidromeSongs,
  pingNavidrome,
  proxyNavidromeCover,
  proxyNavidromeStream
} from "../navidrome";

export function registerNavidromeRoutes(app: FastifyInstance, config: ApiConfig) {
  app.get("/api/navidrome/ping", async () => pingNavidrome(config));

  app.get<{ Querystring: { q?: string } }>("/api/navidrome/songs", async (request) => {
    return getNavidromeSongs(config, request.query.q || "");
  });

  app.get<{ Params: { id: string } }>("/api/navidrome/stream/:id", async (request, reply) => {
    await proxyNavidromeStream(config, request, reply);
  });

  app.get<{ Params: { id: string } }>("/api/navidrome/cover/:id", async (request, reply) => {
    await proxyNavidromeCover(config, request, reply);
  });
}
