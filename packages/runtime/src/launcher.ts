import { createRuntime } from "./index";

const runtime = createRuntime();

function shutdown() {
  runtime.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
  const status = await runtime.start();

  console.log("");
  console.log("Personal Music Stack is ready.");
  console.log("Web console: " + status.webConsoleUrl);
  console.log("Navidrome:    " + status.navidromeUrl);
  console.log("Library:      " + status.libraryDir);
  console.log("");
  console.log("Open the web console in your browser. Press Ctrl+C here to stop local services.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
