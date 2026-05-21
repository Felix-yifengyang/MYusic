import { useEffect, useRef, useState } from "react";
import type { FormEvent, PointerEvent } from "react";
import type { NavidromeSong } from "@myusic/shared";
import type { PlayerTrack } from "./playerTypes";
import { Empty } from "./common";

export type AppView = "player" | "collect" | "ingestions" | "settings";

export interface TurntablePageProps {
  songs: NavidromeSong[];
  query: string;
  error: string;
  currentTrack: PlayerTrack | null;
  currentTrackKey: string;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  onQueryChange: (value: string) => void;
  onSearch: (event: FormEvent) => void;
  onRefresh: () => void;
  onPlay: (song: NavidromeSong) => void;
  onNavigate: (view: Exclude<AppView, "player">) => void;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onEnded: () => void;
}

export function TurntablePage({
  songs,
  query,
  error,
  currentTrack,
  currentTrackKey,
  drawerOpen,
  onDrawerOpenChange,
  onQueryChange,
  onSearch,
  onRefresh,
  onPlay,
  onNavigate,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  onEnded
}: TurntablePageProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
  }, [currentTrack?.key]);

  useEffect(() => {
    if (!drawerOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDrawerOpenChange(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [drawerOpen, onDrawerOpenChange]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  }

  function seek(value: string) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const nextTime = (Number(value) / 100) * duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  return (
    <main className={`turntable-page ${drawerOpen ? "drawer-open" : ""}`}>
      <header className="turntable-topbar">
        <strong>MYusic</strong>
      </header>

      <section className="turntable-stage">
        <section className="machine" aria-label="播放页">
          <div className="plinth">
            <div className={`record ${playing ? "spinning" : ""}`}>
              {currentTrack?.coverUrl ? <img alt="" src={currentTrack.coverUrl} /> : <div className="record-label" />}
            </div>
            <div className="tonearm"><span /></div>
            <div className="machine-meta">
              <p>{currentTrack ? "正在播放" : "等待播放"}</p>
              <h1>{currentTrack?.title || "MYusic Radio"}</h1>
              <span>{currentTrack ? [currentTrack.artist, currentTrack.album].filter(Boolean).join(" · ") : "从唱片抽屉选择一首歌"}</span>
            </div>
            <div className="machine-controls">
              <button type="button" disabled={!canPrevious} onClick={onPrevious}>上一首</button>
              <button className="primary-control" type="button" disabled={!currentTrack} onClick={() => void togglePlayback()}>
                {playing ? "暂停" : "播放"}
              </button>
              <button type="button" disabled={!canNext} onClick={onNext}>下一首</button>
            </div>
            <div className="machine-progress-row">
              <time>{formatTime(currentTime)}</time>
              <input
                aria-label="播放进度"
                className="machine-progress"
                disabled={!currentTrack || !duration}
                max="100"
                min="0"
                onChange={(event) => seek(event.target.value)}
                type="range"
                value={progress}
              />
              <time>{formatTime(duration)}</time>
            </div>
            {currentTrack && (
              <audio
                ref={audioRef}
                autoPlay
                src={currentTrack.streamUrl}
                onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
                onEnded={() => {
                  setPlaying(false);
                  onEnded();
                }}
                onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
                onPause={() => setPlaying(false)}
                onPlay={() => setPlaying(true)}
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              />
            )}
          </div>
        </section>

        <RecordDrawer
          open={drawerOpen}
          songs={songs}
          query={query}
          error={error}
          currentTrack={currentTrack}
          currentTrackKey={currentTrackKey}
          onOpenChange={onDrawerOpenChange}
          onQueryChange={onQueryChange}
          onSearch={onSearch}
          onRefresh={onRefresh}
          onPlay={onPlay}
          onNavigate={onNavigate}
        />
      </section>
    </main>
  );
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function RecordDrawer({
  open,
  songs,
  query,
  error,
  currentTrack,
  currentTrackKey,
  onOpenChange,
  onQueryChange,
  onSearch,
  onRefresh,
  onPlay,
  onNavigate
}: {
  open: boolean;
  songs: NavidromeSong[];
  query: string;
  error: string;
  currentTrack: PlayerTrack | null;
  currentTrackKey: string;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (value: string) => void;
  onSearch: (event: FormEvent) => void;
  onRefresh: () => void;
  onPlay: (song: NavidromeSong) => void;
  onNavigate: (view: Exclude<AppView, "player">) => void;
}) {
  const dragStartXRef = useRef(0);
  const dragMovedRef = useRef(false);
  const currentSong = songs.find((song) => currentTrackKey === `navidrome:${song.id}`);

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    dragStartXRef.current = event.clientX;
    dragMovedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (Math.abs(event.clientX - dragStartXRef.current) > 24) dragMovedRef.current = true;
  }

  function pointerUp(event: PointerEvent<HTMLButtonElement>) {
    const delta = event.clientX - dragStartXRef.current;
    if (delta < -28) onOpenChange(true);
    if (delta > 28) onOpenChange(false);
    if (!dragMovedRef.current) onOpenChange(!open);
  }

  return (
    <aside className="record-drawer" aria-label="音乐库抽屉" aria-expanded={open}>
      <button
        className="drawer-grip"
        type="button"
        aria-label={open ? "收起唱片抽屉" : "拉出唱片抽屉"}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
      >
        <span />
        <span />
        <span />
      </button>

      <div className="drawer-head">
        <div>
          <p>音乐库</p>
          <h2>{songs.length} 张唱片</h2>
        </div>
        <button className="drawer-refresh" type="button" onClick={onRefresh}>刷新</button>
      </div>

      <div className="drawer-now">
        <span>当前播放</span>
        <strong>{currentTrack?.title || "未选择唱片"}</strong>
        <small>{currentTrack ? [currentTrack.artist, currentTrack.album].filter(Boolean).join(" · ") : "从抽屉中挑一张唱片"}</small>
      </div>

      <form className="drawer-search" onSubmit={onSearch}>
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索唱片、歌手、专辑" />
      </form>

      {error ? <div className="error">{error}</div> : null}

      <section className="record-shelf" aria-label="歌曲列表">
        {!songs.length && !error ? <Empty>没有歌曲。确认 Navidrome 已扫描音乐库。</Empty> : songs.map((song) => (
          <article className={`sleeve ${currentTrackKey === `navidrome:${song.id}` ? "current" : ""}`} key={song.id}>
            <button type="button" aria-label={`播放 ${song.title}`} onClick={() => onPlay(song)}>
              {song.coverArt ? <img alt="" src={`/api/navidrome/cover/${encodeURIComponent(song.coverArt)}`} /> : <b />}
              <span className="sleeve-status">{currentSong?.id === song.id ? "播放中" : formatDuration(song.duration)}</span>
              <strong>{song.title}</strong>
              <span>{formatSongMeta(song)}</span>
            </button>
          </article>
        ))}
      </section>

      <nav className="drawer-actions" aria-label="功能入口">
        <button type="button" onClick={() => onNavigate("collect")}>收集</button>
        <button type="button" onClick={() => onNavigate("ingestions")}>入库</button>
        <button type="button" onClick={() => onNavigate("settings")}>设置</button>
      </nav>
    </aside>
  );
}

function formatSongMeta(song: NavidromeSong) {
  return [song.artist || "Unknown", song.album].filter(Boolean).join(" · ");
}

function formatDuration(seconds?: number) {
  if (!seconds) return "播放";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}
