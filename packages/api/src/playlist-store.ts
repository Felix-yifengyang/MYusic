import fs from "node:fs";
import path from "node:path";
import type { Playlist } from "@myusic/shared";

export function loadPlaylists(playlistStorePath: string): Playlist[] {
  if (!fs.existsSync(playlistStorePath)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(playlistStorePath, "utf8")) as Playlist[];
}

export function savePlaylists(playlistStorePath: string, playlists: Playlist[]) {
  fs.mkdirSync(path.dirname(playlistStorePath), { recursive: true });
  const tempPath = `${playlistStorePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(playlists, null, 2) + "\n", "utf8");
  fs.renameSync(tempPath, playlistStorePath);
}
