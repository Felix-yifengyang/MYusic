import type { NavidromeSong } from "@myusic/shared";

export type PlayerTrack = {
  key: string;
  source: "navidrome";
  title: string;
  artist: string;
  album?: string;
  streamUrl: string;
  coverUrl?: string;
};

export function coverUrl(song: NavidromeSong) {
  if (!song.coverArt) return undefined;
  return `/api/navidrome/cover/${encodeURIComponent(song.coverArt)}?songId=${encodeURIComponent(song.id)}`;
}
