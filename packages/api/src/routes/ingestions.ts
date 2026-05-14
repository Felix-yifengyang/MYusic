import type { FastifyInstance } from "fastify";
import type { DownloadJob, IngestionRecord } from "@personal-music/shared";
import type { ApiConfig } from "../config";

export interface RegisterIngestionRoutesOptions {
  config: ApiConfig;
  jobs: DownloadJob[];
  ingestions: IngestionRecord[];
  persist: () => Promise<void>;
  rematchIngestion: (
    config: ApiConfig,
    jobs: DownloadJob[],
    ingestions: IngestionRecord[],
    ingestion: IngestionRecord
  ) => Promise<{ matched: boolean; ingestion: IngestionRecord }>;
}

export function registerIngestionRoutes(app: FastifyInstance, options: RegisterIngestionRoutesOptions) {
  const { config, jobs, ingestions } = options;

  app.get("/api/ingestions", async () => {
    return ingestions.slice().sort((a, b) => (b.updatedAt || b.capturedAt || "").localeCompare(a.updatedAt || a.capturedAt || ""));
  });

  app.post<{ Body: { id?: string } }>("/api/ingestions/rematch", async (request, reply) => {
    const ingestionId = String(request.body?.id || "").trim();
    const ingestion = ingestions.find((item) => item.id === ingestionId);
    if (!ingestion) {
      reply.code(404);
      return { error: "Ingestion record not found." };
    }

    try {
      const result = await options.rematchIngestion(config, jobs, ingestions, ingestion);
      await options.persist();
      return result;
    } catch (error) {
      reply.code(409);
      return { error: error instanceof Error ? error.message : "Failed to rematch ingestion record." };
    }
  });
}
