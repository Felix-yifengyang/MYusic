import { spawn } from "node:child_process";

const children = [
  spawn(process.execPath, ["packages/runtime/dist/launcher.js"], { cwd: process.cwd(), stdio: "inherit" }),
  spawn("pnpm --filter @myusic/web dev", { cwd: process.cwd(), shell: true, stdio: "inherit" })
];

function shutdown(code = 0) {
  for (const child of children) child.kill();
  process.exit(code);
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

for (const child of children) {
  child.on("exit", (code) => shutdown(code ?? 0));
}
