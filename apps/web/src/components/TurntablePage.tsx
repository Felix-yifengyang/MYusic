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
  active: boolean;
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
  active,
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
  const currentTrackKeyRef = useRef(currentTrackKey);
  const audioRetryRef = useRef({ trackKey: "", attempts: 0 });
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
  const [volume, setVolume] = useState(getInitialVolume);
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

  useEffect(() => {
    currentTrackKeyRef.current = currentTrackKey;
  }, [currentTrackKey]);

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
    audioRetryRef.current = { trackKey: currentTrack?.key || "", attempts: 0 };
  }, [currentTrack?.key]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume, currentTrack?.key]);

  useEffect(() => {
    if (!active || !drawerOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") void commitDrawerOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [active, drawerOpen]);

  useEffect(() => {
    if (!active) return;

    const handlePlayerShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isShortcutBlockedTarget(event.target)) return;

      if (event.code === "Space") {
        if (!currentTrack) return;
        event.preventDefault();
        void togglePlayback();
        return;
      }

      if (event.key === "ArrowLeft" && canPrevious) {
        event.preventDefault();
        const sourceRecord = pageRef.current?.querySelector<HTMLElement>(".side-record-previous .side-record-disc");
        changeRecord(onPrevious, sourceRecord ?? undefined);
      }

      if (event.key === "ArrowRight" && canNext) {
        event.preventDefault();
        const sourceRecord = pageRef.current?.querySelector<HTMLElement>(".side-record-next .side-record-disc");
        changeRecord(onNext, sourceRecord ?? undefined);
      }
    };

    window.addEventListener("keydown", handlePlayerShortcut);
    return () => window.removeEventListener("keydown", handlePlayerShortcut);
  });

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
    if (!active || !record || isDocumentHidden()) {
      recordChangeIdRef.current += 1;
      recordChangeTimelineRef.current?.kill();
      recordChangeTimelineRef.current = null;
      flyingRecordRef.current?.remove();
      flyingRecordRef.current = null;
      restoreHiddenSourceRecord(hiddenSourceRecordRef);
      recordChangeLockedRef.current = false;
      drawerGestureRef.current.active = false;
      setDrawerDragProgress(null);
      setRecordChangeLocked(false);
      audioRef.current?.pause();
      selectTrack();
      if (closeDrawer) onDrawerOpenChange(false);
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
    persistVolume(nextVolume);
    if (audioRef.current) audioRef.current.volume = nextVolume;
  }

  function advanceToNextTrack() {
    setPlaying(false);
    if (!canNext) return;

    const sourceRecord = active
      ? pageRef.current?.querySelector<HTMLElement>(".side-record-next .side-record-disc")
      : undefined;
    changeRecord(onEnded, sourceRecord ?? undefined);
  }

  function handleAudioError() {
    if (!currentTrack) return;

    const retryState = audioRetryRef.current;
    if (retryState.trackKey !== currentTrack.key) {
      retryState.trackKey = currentTrack.key;
      retryState.attempts = 0;
    }

    if (retryState.attempts < 1) {
      retryState.attempts += 1;
      setPlaying(false);
      window.setTimeout(() => {
        const audio = audioRef.current;
        if (!audio || currentTrackKeyRef.current !== currentTrack.key) return;
        audio.load();
        void audio.play().catch(() => advanceToNextTrack());
      }, 700);
      return;
    }

    advanceToNextTrack();
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
    <main ref={pageRef} className={`turntable-page ${!active ? "is-inactive" : ""} ${drawerOpen ? "drawer-open" : ""} ${drawerDragProgress !== null ? "drawer-dragging" : ""}`} aria-hidden={!active} style={pageStyle}>
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
                    preload="auto"
                    src={currentTrack.streamUrl}
                    onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
                    onEnded={advanceToNextTrack}
                    onError={handleAudioError}
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
              <section className="volume-console" aria-label="闊抽噺鎺у埗">
                <div className="volume-console-face" aria-hidden="true">
                  <span className="volume-slot" />
                  <span className="volume-tab" />
                </div>
                <input
                  aria-label="闊抽噺"
                  max="100"
                  min="0"
                  onChange={(event) => changeVolume(event.target.value)}
                  type="range"
                  value={Math.round(volume * 100)}
                />
              </section>
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

          </div>
        </section>
      </section>
    </main>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isShortcutBlockedTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (
    target.isContentEditable
    || target.tagName === "INPUT"
    || target.tagName === "TEXTAREA"
    || target.tagName === "SELECT"
    || target.tagName === "BUTTON"
    || target.tagName === "A"
  );
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

type DrawerSoundDirection = "open" | "close";
const DEFAULT_VOLUME = 0.8;
const PLAYER_VOLUME_STORAGE_KEY = "myusic.player.volume";
const DEFAULT_DRAWER_MOTION_MS = 550;

function getInitialVolume() {
  if (typeof window === "undefined") return DEFAULT_VOLUME;

  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(PLAYER_VOLUME_STORAGE_KEY);
  } catch {
    return DEFAULT_VOLUME;
  }

  const parsed = Number(stored);
  return Number.isFinite(parsed) ? clamp(parsed, 0, 1) : DEFAULT_VOLUME;
}

function persistVolume(value: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLAYER_VOLUME_STORAGE_KEY, String(clamp(value, 0, 1)));
  } catch {
    // Storage can be unavailable in hardened browser contexts; playback should still work.
  }
}

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
  loading?: "eager" | "lazy";
  spinning?: boolean;
}>(function VinylRecord({
  coverUrl,
  className = "",
  loading,
  spinning = false
}, ref) {
  return (
    <span ref={ref} className={`vinyl-record ${className} ${spinning ? "spinning" : ""}`}>
      <span className="vinyl-record-label">
        {coverUrl ? <img alt="" loading={loading} src={coverUrl} /> : null}
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
  const [assetsLoaded, setAssetsLoaded] = useState(open);

  useEffect(() => {
    if (open) setAssetsLoaded(true);
  }, [open]);

  return (
    <aside className={`record-drawer ${assetsLoaded ? "drawer-assets-loaded" : ""}`} aria-label="音乐库抽屉" aria-expanded={open}>
      <button
        className="drawer-pull"
        type="button"
        aria-label={open ? "收起音乐抽屉" : "拉开音乐抽屉"}
        aria-expanded={open}
        disabled={drawerLocked}
        onPointerDown={(event) => {
          setAssetsLoaded(true);
          onPullPointerDown(event);
        }}
        onPointerMove={onPullPointerMove}
        onPointerUp={onPullPointerUp}
        onPointerCancel={onPullPointerCancel}
      >
        <span aria-hidden="true" />
      </button>

      <div className="drawer-tools">
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

      <section className="record-shelf" aria-label="歌曲列表">
        {assetsLoaded && (!songs.length && !error ? <div className="drawer-empty" aria-label="没有歌曲"><span /><span /><span /></div> : songs.map((song) => (
          <article className={`sleeve ${currentTrackKey === `navidrome:${song.id}` ? "current" : ""}`} key={song.id}>
            <button
              type="button"
              aria-label={`播放 ${song.title}`}
              onClick={(event) => onPlay(song, event.currentTarget.querySelector<HTMLElement>(".sleeve-record") ?? undefined)}
            >
              <VinylRecord
                className="sleeve-record"
                coverUrl={song.coverArt ? `/api/navidrome/cover/${encodeURIComponent(song.coverArt)}` : undefined}
                loading="lazy"
              />
              <span className="record-note">
                <strong>{song.title}</strong>
                <span>{song.artist || "Unknown"}</span>
                {song.album ? <span>{song.album}</span> : null}
                <small>{formatDuration(song.duration)}</small>
              </span>
            </button>
          </article>
        )))}
      </section>
    </aside>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isDocumentHidden() {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
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

function formatDuration(seconds?: number) {
  if (!seconds) return "--:--";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}
