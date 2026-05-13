import { loadApiConfig } from "./config";
import { createApiServer } from "./server";

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const configPath = getArg("--config") || process.env.PERSONAL_MUSIC_API_CONFIG;
  if (!configPath) {
    throw new Error("Missing --config <path>");
  }

  const config = loadApiConfig(configPath);
  const app = createApiServer({ config });

  await app.listen({ host: config.host, port: config.port });
  console.log(`Personal Music API running at http://127.0.0.1:${config.port}`);
  console.log(`Music directory: ${config.musicDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
