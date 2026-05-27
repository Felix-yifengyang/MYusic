import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, PointerEvent } from "react";
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
  previousTrack: PlayerTrack | null;
  nextTrack: PlayerTrack | null;
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
  previousTrack,
  nextTrack,
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
  const [drawerDragProgress, setDrawerDragProgress] = useState<number | null>(null);
  const drawerGestureRef = useRef({ active: false, startY: 0, startProgress: 0, moved: false, progress: 0 });
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const drawerProgress = drawerDragProgress ?? (drawerOpen ? 1 : 0);
  const pageStyle = { "--drawer-progress": drawerProgress } as CSSProperties;

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

  function drawerPointerDown(event: PointerEvent<HTMLButtonElement>) {
    drawerGestureRef.current = {
      active: true,
      startY: event.clientY,
      startProgress: drawerProgress,
      moved: false,
      progress: drawerProgress
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function drawerPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const gesture = drawerGestureRef.current;
    if (!gesture.active) return;
    const delta = gesture.startY - event.clientY;
    const nextProgress = clamp(gesture.startProgress + delta / 260, 0, 1);
    gesture.progress = nextProgress;
    if (Math.abs(delta) > 8) gesture.moved = true;
    setDrawerDragProgress(nextProgress);
  }

  function drawerPointerUp() {
    const gesture = drawerGestureRef.current;
    if (!gesture.active) return;
    if (gesture.moved) {
      onDrawerOpenChange(gesture.progress > 0.45);
    } else {
      onDrawerOpenChange(!drawerOpen);
    }
    gesture.active = false;
    setDrawerDragProgress(null);
  }

  return (
    <main className={`turntable-page ${drawerOpen ? "drawer-open" : ""}`} style={pageStyle}>
      <header className="turntable-topbar">
        <strong>MYusic</strong>
      </header>

      <section className="turntable-stage">
        <RecordDrawer
          open={drawerOpen}
          songs={songs}
          query={query}
          error={error}
          currentTrack={currentTrack}
          currentTrackKey={currentTrackKey}
          onQueryChange={onQueryChange}
          onSearch={onSearch}
          onRefresh={onRefresh}
          onPlay={onPlay}
          onNavigate={onNavigate}
        />

        <section className="desktop-layer" aria-label="播放页">
          <div className="desktop-surface">
            <SideRecord
              side="previous"
              track={previousTrack}
              disabled={!canPrevious}
              onClick={onPrevious}
            />

            <section className="machine" aria-label="唱片机">
              <div className="plinth">
                <div className={`record ${playing ? "spinning" : ""}`}>
                  {currentTrack?.coverUrl ? <img alt="" src={currentTrack.coverUrl} /> : <div className="record-label" />}
                </div>
                <div className={`tonearm ${playing ? "is-playing" : ""}`}><span /></div>
                <div className="machine-meta">
                  {currentTrack ? (
                    <>
                      <p>{playing ? "唱针已落下" : "唱针待命"}</p>
                      <h1>{currentTrack.title}</h1>
                      <span>{[currentTrack.artist, currentTrack.album].filter(Boolean).join(" · ")}</span>
                    </>
                  ) : (
                    <>
                      <p>等待选片</p>
                      <h1>拉开抽屉，选择一张唱片</h1>
                      <span>MYusic</span>
                    </>
                  )}
                </div>
                <div className="machine-controls">
                  <button
                    className={`deck-button deck-button-main ${playing ? "is-active" : ""}`}
                    type="button"
                    aria-label={playing ? "暂停" : "播放"}
                    disabled={!currentTrack}
                    onClick={() => void togglePlayback()}
                  >
                    <span className={`deck-button-icon ${playing ? "deck-button-icon-pause" : "deck-button-icon-play"}`} aria-hidden="true" />
                  </button>
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

            <SideRecord
              side="next"
              track={nextTrack}
              disabled={!canNext}
              onClick={onNext}
            />
          </div>

          <button
            className="drawer-pull"
            type="button"
            aria-label={drawerOpen ? "收起音乐抽屉" : "拉开音乐抽屉"}
            aria-expanded={drawerOpen}
            onPointerDown={drawerPointerDown}
            onPointerMove={drawerPointerMove}
            onPointerUp={drawerPointerUp}
            onPointerCancel={() => {
              drawerGestureRef.current.active = false;
              setDrawerDragProgress(null);
            }}
          >
            <span />
            <strong>{drawerOpen ? "收起音乐抽屉" : "拉开音乐抽屉"}</strong>
          </button>
        </section>
      </section>
    </main>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function SideRecord({
  side,
  track,
  disabled,
  onClick
}: {
  side: "previous" | "next";
  track: PlayerTrack | null;
  disabled: boolean;
  onClick: () => void;
}) {
  const label = side === "previous" ? "上一首" : "下一首";

  return (
    <button
      className={`side-record side-record-${side}`}
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="side-record-disc">
        {track?.coverUrl ? <img alt="" src={track.coverUrl} /> : <i />}
      </span>
      <span className="side-record-meta">
        <small>{label}</small>
        <strong>{track?.title || "暂无唱片"}</strong>
      </span>
    </button>
  );
}

function RecordDrawer({
  open,
  songs,
  query,
  error,
  currentTrack,
  currentTrackKey,
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
  onQueryChange: (value: string) => void;
  onSearch: (event: FormEvent) => void;
  onRefresh: () => void;
  onPlay: (song: NavidromeSong) => void;
  onNavigate: (view: Exclude<AppView, "player">) => void;
}) {
  const currentSong = songs.find((song) => currentTrackKey === `navidrome:${song.id}`);

  return (
    <aside className="record-drawer" aria-label="音乐库抽屉" aria-expanded={open}>
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
