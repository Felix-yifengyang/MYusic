import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

export function loadRuntimeEnv(rootDir: string) {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return;

  dotenv.config({ path: envPath });
}
