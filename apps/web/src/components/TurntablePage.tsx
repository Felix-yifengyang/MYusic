import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, PointerEvent } from "react";
import type { NavidromeSong } from "@myusic/shared";
import type { PlayerTrack } from "./playerTypes";
import { Empty } from "./common";
import drawerCloseSoundUrl from "../assets/sound/close.mp3";
import drawerOpenSoundUrl from "../assets/sound/open.mp3";

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
  const drawerSoundRef = useRef<DrawerSoundState>({
    context: null,
    loaded: {},
    loading: {},
    playId: 0,
    source: null
  });
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [drawerDragProgress, setDrawerDragProgress] = useState<number | null>(null);
  const [drawerMotionMs, setDrawerMotionMs] = useState(DEFAULT_DRAWER_MOTION_MS);
  const drawerGestureRef = useRef({ active: false, startY: 0, startProgress: 0, moved: false, progress: 0 });
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const drawerProgress = drawerDragProgress ?? (drawerOpen ? 1 : 0);
  const pageStyle = {
    "--drawer-duration": `${drawerMotionMs}ms`,
    "--drawer-progress": drawerProgress,
    "--play-progress": progress / 100,
    "--play-progress-percent": `${progress}%`
  } as CSSProperties;

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
  }, [currentTrack?.key]);

  useEffect(() => {
    if (!drawerOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") void commitDrawerOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [drawerOpen]);

  async function commitDrawerOpen(nextOpen: boolean) {
    if (nextOpen !== drawerOpen) {
      const soundDurationMs = await playDrawerSound(drawerSoundRef, nextOpen ? "open" : "close")
        .catch(() => DEFAULT_DRAWER_MOTION_MS);
      setDrawerMotionMs(soundDurationMs);
    }
    onDrawerOpenChange(nextOpen);
  }

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
      void commitDrawerOpen(gesture.progress > 0.45);
    } else {
      void commitDrawerOpen(!drawerOpen);
    }
    gesture.active = false;
    setDrawerDragProgress(null);
  }

  return (
    <main className={`turntable-page ${drawerOpen ? "drawer-open" : ""} ${drawerDragProgress !== null ? "drawer-dragging" : ""}`} style={pageStyle}>
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
          onPullPointerDown={drawerPointerDown}
          onPullPointerMove={drawerPointerMove}
          onPullPointerUp={drawerPointerUp}
          onPullPointerCancel={() => {
            drawerGestureRef.current.active = false;
            setDrawerDragProgress(null);
          }}
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
                <div className="platter" aria-hidden="true" />
                <VinylRecord className="record" coverUrl={currentTrack?.coverUrl} spinning={playing} />
                <button
                  className={`tonearm ${playing ? "is-playing" : ""}`}
                  type="button"
                  aria-label={playing ? "抬起唱臂" : "落下唱臂"}
                  disabled={!currentTrack}
                  onClick={() => void togglePlayback()}
                >
                  <span className="tonearm-wand" />
                  <span className="tonearm-cartridge" />
                </button>
                <div className="tonearm-base" aria-hidden="true"><span /></div>
                <div className="turntable-screws" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
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

            {currentTrack && (
              <p className="track-inscription">
                {[currentTrack.title, currentTrack.artist, currentTrack.album].filter(Boolean).join(" · ")}
              </p>
            )}

            <section className="table-progress" aria-label="播放进度">
              <time>{formatTime(currentTime)}</time>
              <div className="carved-progress">
                <span aria-hidden="true" />
                <input
                  aria-label="播放进度"
                  disabled={!currentTrack || !duration}
                  max="100"
                  min="0"
                  onChange={(event) => seek(event.target.value)}
                  type="range"
                  value={progress}
                />
              </div>
              <time>{formatTime(duration)}</time>
            </section>
          </div>
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

type DrawerSoundDirection = "open" | "close";
const DEFAULT_DRAWER_MOTION_MS = 550;

interface DrawerSoundState {
  context: AudioContext | null;
  loaded: Partial<Record<DrawerSoundDirection, AudioBuffer>>;
  loading: Partial<Record<DrawerSoundDirection, Promise<AudioBuffer>>>;
  playId: number;
  source: AudioBufferSourceNode | null;
}

async function playDrawerSound(soundRef: { current: DrawerSoundState }, direction: DrawerSoundDirection) {
  if (typeof window === "undefined") return DEFAULT_DRAWER_MOTION_MS;
  const AudioContextCtor = window.AudioContext ?? (window as Window & typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  }).webkitAudioContext;
  if (!AudioContextCtor) return DEFAULT_DRAWER_MOTION_MS;

  const state = soundRef.current;
  const playId = state.playId + 1;
  state.playId = playId;
  const context = state.context ?? new AudioContextCtor();
  state.context = context;
  if (context.state === "suspended") await context.resume();

  if (!state.loading[direction]) {
    const soundUrl = direction === "open" ? drawerOpenSoundUrl : drawerCloseSoundUrl;
    state.loading[direction] = fetch(soundUrl)
      .then((response) => response.arrayBuffer())
      .then((buffer) => context.decodeAudioData(buffer));
  }

  state.loaded[direction] = state.loaded[direction] ?? await state.loading[direction];
  const buffer = state.loaded[direction];
  if (!buffer) return DEFAULT_DRAWER_MOTION_MS;
  const soundDurationMs = Math.max(120, Math.round(buffer.duration * 1000));
  if (playId !== state.playId) return soundDurationMs;

  try {
    state.source?.stop();
  } catch {
    // The previous one-shot source may already have ended.
  }
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.value = 0.72;
  source.connect(gain);
  gain.connect(context.destination);
  source.start();
  state.source = source;
  source.onended = () => {
    if (state.source === source) state.source = null;
  };
  return soundDurationMs;
}

function VinylRecord({
  coverUrl,
  className = "",
  spinning = false
}: {
  coverUrl?: string;
  className?: string;
  spinning?: boolean;
}) {
  return (
    <span className={`vinyl-record ${className} ${spinning ? "spinning" : ""}`}>
      <span className="vinyl-record-label">
        {coverUrl ? <img alt="" src={coverUrl} /> : null}
      </span>
    </span>
  );
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
      <VinylRecord className="side-record-disc" coverUrl={track?.coverUrl} />
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
  onNavigate,
  onPullPointerDown,
  onPullPointerMove,
  onPullPointerUp,
  onPullPointerCancel
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
  onPullPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPullPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPullPointerUp: () => void;
  onPullPointerCancel: () => void;
}) {
  const currentSong = songs.find((song) => currentTrackKey === `navidrome:${song.id}`);

  return (
    <aside className="record-drawer" aria-label="音乐库抽屉" aria-expanded={open}>
      <button
        className="drawer-pull"
        type="button"
        aria-label={open ? "收起音乐抽屉" : "拉开音乐抽屉"}
        aria-expanded={open}
        onPointerDown={onPullPointerDown}
        onPointerMove={onPullPointerMove}
        onPointerUp={onPullPointerUp}
        onPointerCancel={onPullPointerCancel}
      >
        <span aria-hidden="true" />
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
              <VinylRecord
                className="sleeve-record"
                coverUrl={song.coverArt ? `/api/navidrome/cover/${encodeURIComponent(song.coverArt)}` : undefined}
              />
              <span className="sleeve-status">{currentSong?.id === song.id ? "播放中" : formatDuration(song.duration)}</span>
              <strong>{song.title}</strong>
              <span className="sleeve-meta">{formatSongMeta(song)}</span>
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
