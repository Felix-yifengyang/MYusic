import type { FormEvent } from "react";
import type { NavidromeSong } from "@myusic/shared";
import type { PlayerTrack } from "./PlayerBar";
import { Empty } from "./common";

export interface LibraryPanelProps {
  songs: NavidromeSong[];
  query: string;
  error: string;
  navidromeUrl: string;
  currentTrackKey: string;
  queue: PlayerTrack[];
  queueIndex: number;
  onQueryChange: (value: string) => void;
  onSearch: (event: FormEvent) => void;
  onRefresh: () => void;
  onPlay: (song: NavidromeSong) => void;
}

export function LibraryPanel({
  songs,
  query,
  error,
  navidromeUrl,
  currentTrackKey,
  queue,
  queueIndex,
  onQueryChange,
  onSearch,
  onRefresh,
  onPlay
}: LibraryPanelProps) {
  const currentQueueTrack = queueIndex >= 0 ? queue[queueIndex] : null;
  const nextQueueTrack = queueIndex >= 0 && queueIndex < queue.length - 1 ? queue[queueIndex + 1] : null;

  return (
    <div className="navidrome-panel">
      <div className="section-heading">
        <h2>音乐库</h2>
        <div className="inline-actions">
          <button className="button secondary compact" type="button" onClick={onRefresh}>刷新</button>
          <a className="button secondary compact" href={navidromeUrl} target="_blank" rel="noreferrer">管理页</a>
        </div>
      </div>
      <form className="search-form" onSubmit={onSearch}>
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索标题、歌手、专辑" />
        <button className="button secondary compact" type="submit">搜索</button>
      </form>
      {error && <div className="error">{error}</div>}
      {currentQueueTrack && (
        <div className="queue-summary">
          <div>
            <strong>当前播放</strong>
            <div className="meta">{currentQueueTrack.title} · {queueIndex + 1}/{queue.length}</div>
          </div>
          <div>
            <strong>下一首</strong>
            <div className="meta">{nextQueueTrack ? nextQueueTrack.title : "队列已到末尾"}</div>
          </div>
        </div>
      )}
      <div className="navidrome-songs">
        {!songs.length && !error ? <Empty>没有歌曲。确认 Navidrome 已扫描音乐库，并在设置中填写账号密码。</Empty> : songs.map((song) => (
          <article className={`navidrome-song ${currentTrackKey === `navidrome:${song.id}` ? "active" : ""}`} key={song.id}>
            {song.coverArt ? <img alt="" src={`/api/navidrome/cover/${encodeURIComponent(song.coverArt)}`} /> : <div className="cover-placeholder" />}
            <div>
              <div className="song-title">{song.title}</div>
              <div className="meta">{song.artist || "Unknown"} · {song.album || "Unknown"}</div>
            </div>
            <button className="button secondary compact" type="button" onClick={() => onPlay(song)}>
              {currentTrackKey === `navidrome:${song.id}` ? "播放中" : "播放"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
