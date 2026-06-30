import type { FastifyInstance } from "fastify";
import type { DownloadJob, IngestionRecord } from "@myusic/shared";
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

  app.get("/api/ingestions", async (request) => {
    const userId = request.auth?.user.id;
    return ingestions
      .filter((ingestion) => belongsToUser(ingestion, userId))
      .slice()
      .sort((a, b) => (b.updatedAt || b.capturedAt || "").localeCompare(a.updatedAt || a.capturedAt || ""));
  });

  app.post<{ Body: { id?: string } }>("/api/ingestions/rematch", async (request, reply) => {
    const ingestionId = String(request.body?.id || "").trim();
    const ingestion = ingestions.find((item) => item.id === ingestionId && belongsToUser(item, request.auth?.user.id));
    if (!ingestion) {
      reply.code(404);
      return { error: "Ingestion record not found." };
    }

    const result = await options.rematchIngestion(config, jobs, ingestions, ingestion);
    await options.persist();
    return result;
  });
}

function belongsToUser(record: { userId?: string }, userId?: string) {
  return userId ? record.userId === userId : true;
}
