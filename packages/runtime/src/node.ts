import fs from "node:fs";
import path from "node:path";

export function resolveNodeCommand() {
  const pathValue = process.env.Path || process.env.PATH || "";
  const segments = pathValue.split(path.delimiter).filter(Boolean);

  for (const segment of segments) {
    const candidate = path.join(segment, process.platform === "win32" ? "node.exe" : "node");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return process.platform === "win32" ? "node.exe" : "node";
}
