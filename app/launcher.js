const { createRuntime } = require("./runtime");

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
  console.log("Collector:  " + status.collectorUrl);
  console.log("Navidrome:  " + status.navidromeUrl);
  console.log("Library:    " + status.libraryDir);
  console.log("");
  console.log("Press Ctrl+C to stop services started by this launcher.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
