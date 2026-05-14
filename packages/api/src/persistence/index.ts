import type { ApiConfig } from "../config";
import { createJsonRepository } from "./json-repository";
import { createPostgresRepository } from "./postgres-repository";
import type { AppStateRepository } from "./repository";

export function createRepository(config: ApiConfig): AppStateRepository {
  if (config.database.driver === "postgres") {
    return createPostgresRepository(config);
  }

  return createJsonRepository(config);
}
