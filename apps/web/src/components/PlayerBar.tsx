export type PlayerTrack = {
  key: string;
  source: "navidrome";
  title: string;
  artist: string;
  album?: string;
  streamUrl: string;
  coverUrl?: string;
};

export interface PlayerBarProps {
  track: PlayerTrack | null;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onEnded: () => void;
  onClose: () => void;
}

export function PlayerBar({
  track,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  onEnded,
  onClose
}: PlayerBarProps) {
  if (!track) return null;

  return (
    <div className="player-bar">
      {track.coverUrl ? <img alt="" src={track.coverUrl} /> : <div className="cover-placeholder" />}
      <div className="player-info">
        <div className="song-title">{track.title}</div>
        <div className="meta">{track.artist}{track.album ? ` · ${track.album}` : ""}</div>
      </div>
      <div className="player-controls">
        <button className="button secondary compact" type="button" disabled={!canPrevious} onClick={onPrevious}>上一首</button>
        <audio controls autoPlay src={track.streamUrl} onEnded={onEnded} />
        <button className="button secondary compact" type="button" disabled={!canNext} onClick={onNext}>下一首</button>
      </div>
      <button className="button secondary compact" type="button" onClick={onClose}>关闭</button>
    </div>
  );
}
