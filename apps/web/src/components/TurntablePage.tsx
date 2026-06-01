import { forwardRef, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import type { NavidromeSong } from "@myusic/shared";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { PlayerTrack } from "./playerTypes";
import drawerCloseSoundUrl from "../assets/sound/close.mp3";
import drawerOpenSoundUrl from "../assets/sound/open.mp3";

gsap.registerPlugin(useGSAP);

export type AppView = "player" | "collect" | "ingestions" | "settings";

export interface TurntablePageProps {
  songs: NavidromeSong[];
  error: string;
  currentTrack: PlayerTrack | null;
  currentTrackKey: string;
  previousTrack: PlayerTrack | null;
  nextTrack: PlayerTrack | null;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
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
  error,
  currentTrack,
  currentTrackKey,
  previousTrack,
  nextTrack,
  drawerOpen,
  onDrawerOpenChange,
  onRefresh,
  onPlay,
  onNavigate,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  onEnded
}: TurntablePageProps) {
  const pageRef = useRef<HTMLElement | null>(null);
  const recordRef = useRef<HTMLSpanElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordChangeTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const flyingRecordRef = useRef<HTMLElement | null>(null);
  const hiddenSourceRecordRef = useRef<HTMLElement | null>(null);
  const recordChangeIdRef = useRef(0);
  const recordChangeLockedRef = useRef(false);
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
  const [volume, setVolume] = useState(0.8);
  const [recordChangeLocked, setRecordChangeLocked] = useState(false);
  const [drawerDragProgress, setDrawerDragProgress] = useState<number | null>(null);
  const [drawerMotionMs, setDrawerMotionMs] = useState(DEFAULT_DRAWER_MOTION_MS);
  const drawerGestureRef = useRef({ active: false, startY: 0, startProgress: 0, moved: false, progress: 0 });
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const drawerProgress = drawerDragProgress ?? (drawerOpen ? 1 : 0);
  const pageStyle = {
    "--drawer-duration": `${drawerMotionMs}ms`,
    "--drawer-progress": drawerProgress,
    "--play-progress": progress / 100,
    "--play-progress-percent": `${progress}%`,
    "--volume-inverse": 1 - volume
  } as CSSProperties;

  useGSAP(() => {
    return () => {
      recordChangeTimelineRef.current?.kill();
      flyingRecordRef.current?.remove();
      restoreHiddenSourceRecord(hiddenSourceRecordRef);
      recordChangeLockedRef.current = false;
    };
  }, { scope: pageRef });

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
  }, [currentTrack?.key]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume, currentTrack?.key]);

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

  function changeRecord(selectTrack: () => void, sourceRecord?: HTMLElement, closeDrawer = false) {
    const record = recordRef.current;
    if (!record) {
      selectTrack();
      return;
    }

    const changeId = recordChangeIdRef.current + 1;
    recordChangeIdRef.current = changeId;
    recordChangeTimelineRef.current?.kill();
    flyingRecordRef.current?.remove();
    flyingRecordRef.current = null;
    restoreHiddenSourceRecord(hiddenSourceRecordRef);
    recordChangeLockedRef.current = true;
    drawerGestureRef.current.active = false;
    setDrawerDragProgress(null);
    setRecordChangeLocked(true);
    audioRef.current?.pause();

    const reducedMotion = prefersReducedMotion();
    const timeline = gsap.timeline({
      defaults: { overwrite: "auto" },
      onComplete: () => {
        if (recordChangeIdRef.current !== changeId) return;
        recordChangeTimelineRef.current = null;
        flyingRecordRef.current?.remove();
        flyingRecordRef.current = null;
        restoreHiddenSourceRecord(hiddenSourceRecordRef);
        gsap.set(record, { clearProps: "opacity,visibility,scale" });
        recordChangeLockedRef.current = false;
        setRecordChangeLocked(false);
      }
    });
    recordChangeTimelineRef.current = timeline;

    if (reducedMotion) {
      timeline.call(selectTrack);
      if (closeDrawer) timeline.call(() => void commitDrawerOpen(false));
      return;
    }

    timeline
      .to({}, { duration: 0.22 })
      .to(record, { autoAlpha: 0, scale: 0.94, duration: 0.22, ease: "power2.inOut" });

    if (sourceRecord) {
      const flyingRecord = createFlyingRecord(sourceRecord, record);
      flyingRecordRef.current = flyingRecord;
      hiddenSourceRecordRef.current = sourceRecord;
      gsap.set(sourceRecord, { autoAlpha: 0 });
      pageRef.current?.appendChild(flyingRecord);
      const flight = getRecordFlight(flyingRecord, record);
      timeline
        .to(flyingRecord, {
          x: flight.liftX,
          y: flight.liftY,
          scale: 0.96,
          rotation: -4,
          duration: 0.16,
          ease: "power2.out"
        })
        .to(flyingRecord, {
          x: flight.approachX,
          y: flight.approachY,
          scale: flight.targetScale * 0.94,
          rotation: 3,
          duration: 0.46,
          ease: "power2.inOut"
        })
        .to(flyingRecord, {
          x: flight.targetX,
          y: flight.targetY,
          scale: flight.targetScale,
          rotation: 0,
          duration: 0.2,
          ease: "power2.out"
        })
        .call(() => {
          if (recordChangeIdRef.current !== changeId) return;
          selectTrack();
        })
        .to(flyingRecord, { autoAlpha: 0, scale: flight.targetScale * 0.985, duration: 0.08, ease: "power1.out" })
        .call(() => {
          flyingRecord.remove();
          if (flyingRecordRef.current === flyingRecord) flyingRecordRef.current = null;
          restoreHiddenSourceRecord(hiddenSourceRecordRef);
        })
        .call(() => {
          if (closeDrawer) void commitDrawerOpen(false);
        }, undefined, "-=0.04");
    } else {
      timeline.call(selectTrack);
    }

    timeline.fromTo(
      record,
      { autoAlpha: 0, scale: 0.9 },
      { autoAlpha: 1, scale: 1, duration: 0.24, ease: "power2.out" }
    );
  }

  function seek(value: string) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const nextTime = (Number(value) / 100) * duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function changeVolume(value: string) {
    const nextVolume = clamp(Number(value) / 100, 0, 1);
    setVolume(nextVolume);
    if (audioRef.current) audioRef.current.volume = nextVolume;
  }

  function drawerPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (recordChangeLockedRef.current) return;
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
    <main ref={pageRef} className={`turntable-page ${drawerOpen ? "drawer-open" : ""} ${drawerDragProgress !== null ? "drawer-dragging" : ""}`} style={pageStyle}>
      <header className="turntable-topbar">
        <strong>MYusic</strong>
      </header>

      <section className="turntable-stage">
        <RecordDrawer
          open={drawerOpen}
          songs={songs}
          error={error}
          currentTrackKey={currentTrackKey}
          drawerLocked={recordChangeLocked}
          onRefresh={onRefresh}
          onPlay={(song, sourceRecord) => changeRecord(() => onPlay(song), sourceRecord, true)}
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
              onClick={(sourceRecord) => changeRecord(onPrevious, sourceRecord)}
            />

            <section className="machine" aria-label="唱片机">
              <div className="plinth">
                <div className="platter" aria-hidden="true" />
                <VinylRecord ref={recordRef} className="record" coverUrl={currentTrack?.coverUrl} spinning={playing} />
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
                    onLoadedMetadata={(event) => {
                      event.currentTarget.volume = volume;
                      setDuration(event.currentTarget.duration || 0);
                    }}
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
              onClick={(sourceRecord) => changeRecord(onNext, sourceRecord)}
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

            <section className="volume-console" aria-label="音量控制">
              <div className="volume-console-face" aria-hidden="true">
                <span className="volume-slot" />
                <span className="volume-tab" />
              </div>
              <input
                aria-label="音量"
                max="100"
                min="0"
                onChange={(event) => changeVolume(event.target.value)}
                type="range"
                value={Math.round(volume * 100)}
              />
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

const VinylRecord = forwardRef<HTMLSpanElement, {
  coverUrl?: string;
  className?: string;
  spinning?: boolean;
}>(function VinylRecord({
  coverUrl,
  className = "",
  spinning = false
}, ref) {
  return (
    <span ref={ref} className={`vinyl-record ${className} ${spinning ? "spinning" : ""}`}>
      <span className="vinyl-record-label">
        {coverUrl ? <img alt="" src={coverUrl} /> : null}
      </span>
    </span>
  );
});

function SideRecord({
  side,
  track,
  disabled,
  onClick
}: {
  side: "previous" | "next";
  track: PlayerTrack | null;
  disabled: boolean;
  onClick: (sourceRecord: HTMLElement | undefined) => void;
}) {
  const label = side === "previous" ? "上一首" : "下一首";

  return (
    <button
      className={`side-record side-record-${side}`}
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(event) => onClick(event.currentTarget.querySelector<HTMLElement>(".side-record-disc") ?? undefined)}
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
  error,
  currentTrackKey,
  drawerLocked,
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
  error: string;
  currentTrackKey: string;
  drawerLocked: boolean;
  onRefresh: () => void;
  onPlay: (song: NavidromeSong, sourceRecord: HTMLElement | undefined) => void;
  onNavigate: (view: Exclude<AppView, "player">) => void;
  onPullPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPullPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPullPointerUp: () => void;
  onPullPointerCancel: () => void;
}) {
  const shelfRef = useRef<HTMLElement | null>(null);
  const [page, setPage] = useState(0);
  const [pageCapacity, setPageCapacity] = useState(() => getDrawerPageCapacity());
  const pageCount = Math.max(1, Math.ceil(songs.length / pageCapacity));
  const visibleSongs = songs.slice(page * pageCapacity, (page + 1) * pageCapacity);

  useEffect(() => {
    const shelf = shelfRef.current;
    if (!shelf) return;

    const updatePageCapacity = () => {
      setPageCapacity(getDrawerPageCapacity(shelf.clientWidth, shelf.clientHeight));
    };
    const observer = new ResizeObserver(updatePageCapacity);
    observer.observe(shelf);
    updatePageCapacity();
    window.addEventListener("resize", updatePageCapacity);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePageCapacity);
    };
  }, []);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  useEffect(() => {
    const currentIndex = songs.findIndex((song) => currentTrackKey === `navidrome:${song.id}`);
    if (currentIndex >= 0) setPage(Math.floor(currentIndex / pageCapacity));
  }, [currentTrackKey, pageCapacity, songs]);

  return (
    <aside className="record-drawer" aria-label="音乐库抽屉" aria-expanded={open}>
      <button
        className="drawer-pull"
        type="button"
        aria-label={open ? "收起音乐抽屉" : "拉开音乐抽屉"}
        aria-expanded={open}
        disabled={drawerLocked}
        onPointerDown={onPullPointerDown}
        onPointerMove={onPullPointerMove}
        onPointerUp={onPullPointerUp}
        onPointerCancel={onPullPointerCancel}
      >
        <span aria-hidden="true" />
      </button>

      <div className="drawer-tools">
        {pageCount > 1 ? (
          <div className="drawer-pagination">
            <button
              className="drawer-icon-button drawer-page-previous"
              type="button"
              aria-label="上一页唱片"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              <span aria-hidden="true" />
            </button>
            <button
              className="drawer-icon-button drawer-page-next"
              type="button"
              aria-label="下一页唱片"
              disabled={page === pageCount - 1}
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            >
              <span aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <button className="drawer-refresh drawer-icon-button" type="button" aria-label="刷新" onClick={onRefresh}>
          <span aria-hidden="true" />
        </button>
        <nav className="drawer-actions" aria-label="功能入口">
          <button className="drawer-icon-button drawer-action-collect" type="button" aria-label="收集" onClick={() => onNavigate("collect")}><span aria-hidden="true" /></button>
          <button className="drawer-icon-button drawer-action-ingestions" type="button" aria-label="入库" onClick={() => onNavigate("ingestions")}><span aria-hidden="true" /></button>
          <button className="drawer-icon-button drawer-action-settings" type="button" aria-label="设置" onClick={() => onNavigate("settings")}><span aria-hidden="true" /></button>
        </nav>
      </div>

      {error ? <div className="drawer-error-light" role="status" aria-label={error} /> : null}

      <section ref={shelfRef} className="record-shelf" aria-label={`歌曲列表，第 ${page + 1} 页`}>
        {!songs.length && !error ? <div className="drawer-empty" aria-label="没有歌曲"><span /><span /><span /></div> : visibleSongs.map((song) => (
          <article className={`sleeve ${currentTrackKey === `navidrome:${song.id}` ? "current" : ""}`} key={song.id}>
            <button
              type="button"
              aria-label={`播放 ${song.title}`}
              onClick={(event) => onPlay(song, event.currentTarget.querySelector<HTMLElement>(".sleeve-record") ?? undefined)}
            >
              <VinylRecord
                className="sleeve-record"
                coverUrl={song.coverArt ? `/api/navidrome/cover/${encodeURIComponent(song.coverArt)}` : undefined}
              />
              <span className="record-note">
                <strong>{song.title}</strong>
                <span>{song.artist || "Unknown"}</span>
                {song.album ? <span>{song.album}</span> : null}
                <small>{formatDuration(song.duration)}</small>
              </span>
            </button>
          </article>
        ))}
      </section>
    </aside>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function createFlyingRecord(sourceRecord: HTMLElement, targetRecord: HTMLElement) {
  const flyingRecord = sourceRecord.cloneNode(true) as HTMLElement;
  const sourceRect = sourceRecord.getBoundingClientRect();
  flyingRecord.classList.add("flying-record");
  flyingRecord.classList.remove("spinning");
  flyingRecord.dataset.from = JSON.stringify({
    autoAlpha: 1,
    x: sourceRect.left,
    y: sourceRect.top,
    width: sourceRect.width,
    height: sourceRect.height,
    scale: 1
  });
  gsap.set(flyingRecord, JSON.parse(flyingRecord.dataset.from));
  return flyingRecord;
}

function getRecordFlight(flyingRecord: HTMLElement, targetRecord: HTMLElement) {
  const sourceRect = flyingRecord.getBoundingClientRect();
  const targetRect = targetRecord.getBoundingClientRect();
  const targetScale = targetRect.width / sourceRect.width;
  const liftY = sourceRect.top - Math.max(42, window.innerHeight * 0.07);
  return {
    liftX: sourceRect.left,
    liftY,
    approachX: targetRect.left + targetRect.width * 0.04,
    approachY: targetRect.top - Math.max(30, targetRect.height * 0.1),
    targetX: targetRect.left,
    targetY: targetRect.top,
    targetScale
  };
}

function restoreHiddenSourceRecord(sourceRecordRef: { current: HTMLElement | null }) {
  if (!sourceRecordRef.current) return;
  gsap.set(sourceRecordRef.current, { clearProps: "opacity,visibility" });
  sourceRecordRef.current = null;
}

function getDrawerPageCapacity(shelfWidth?: number, shelfHeight?: number) {
  if (typeof window === "undefined") return 12;
  const cardWidth = window.innerWidth <= 600 ? 145 : window.innerWidth <= 900 ? 155 : 180;
  const columns = window.innerWidth <= 600
    ? 2
    : shelfWidth
      ? Math.max(1, Math.floor((shelfWidth + DRAWER_SHELF_GAP) / (cardWidth + DRAWER_SHELF_GAP)))
      : window.innerWidth <= 900 ? 4 : 6;
  const rows = shelfHeight
    ? Math.max(1, Math.floor((shelfHeight + DRAWER_SHELF_GAP) / (cardWidth + DRAWER_NOTE_SPACE + DRAWER_SHELF_GAP)))
    : 2;
  return columns * rows;
}

const DRAWER_SHELF_GAP = 12;
const DRAWER_NOTE_SPACE = 10;

function formatDuration(seconds?: number) {
  if (!seconds) return "--:--";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}
