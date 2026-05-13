import fs from "node:fs";
import path from "node:path";
import type { Track } from "@personal-music/shared";

const audioExtensions = new Set([".aac", ".aiff", ".alac", ".flac", ".m4a", ".mp3", ".ogg", ".opus", ".wav", ".wma"]);

export function scanLibrary(musicDir: string): Track[] {
  const files: Track[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!audioExtensions.has(ext)) continue;

      const stat = fs.statSync(fullPath);
      const relativePath = path.relative(musicDir, fullPath);
      const parts = relativePath.split(path.sep);

      files.push({
        title: path.basename(entry.name, ext),
        artist: parts.length > 1 ? parts[0] : "Unknown",
        fileName: entry.name,
        relativePath,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString()
      });
    }
  }

  walk(musicDir);
  return files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}
