import fs from "node:fs";
import path from "node:path";
import type { Playlist } from "@myusic/shared";

export function loadPlaylists(playlistStorePath: string): Playlist[] {
  if (!fs.existsSync(playlistStorePath)) {
    return [];
  }

  const raw = fs.readFileSync(playlistStorePath, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw) as Playlist[];
  return Array.isArray(parsed) ? parsed.map(normalizePlaylist).filter(Boolean) as Playlist[] : [];
}

export function savePlaylists(playlistStorePath: string, playlists: Playlist[]) {
  fs.mkdirSync(path.dirname(playlistStorePath), { recursive: true });
  const tempPath = `${playlistStorePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(playlists, null, 2) + "\n", "utf8");
  fs.renameSync(tempPath, playlistStorePath);
}

function normalizePlaylist(value: Playlist): Playlist | undefined {
  if (!value || typeof value.id !== "string" || typeof value.name !== "string") return undefined;

  return {
    ...value,
    items: Array.isArray(value.items) ? value.items.filter((item) => item?.id && item.songId) : []
  };
}
