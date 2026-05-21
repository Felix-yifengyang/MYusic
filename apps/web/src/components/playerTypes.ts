export type PlayerTrack = {
  key: string;
  source: "navidrome";
  title: string;
  artist: string;
  album?: string;
  streamUrl: string;
  coverUrl?: string;
};
