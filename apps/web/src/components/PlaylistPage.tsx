import { useEffect, useMemo, useState } from "react";
import type { NavidromeSong, Playlist } from "@myusic/shared";

const backboardAsset = new URL("../assets/images/playlist/playlist-backboard.png", import.meta.url).href;
const sheetAsset = new URL("../assets/images/playlist/playlist-sheet.png", import.meta.url).href;
const clipAsset = new URL("../assets/images/playlist/playlist-clip.png", import.meta.url).href;
const tabAsset = new URL("../assets/images/playlist/playlist-tab.png", import.meta.url).href;

interface PlaylistPageProps {
  active: boolean;
  playlists: Playlist[];
  songs: NavidromeSong[];
  selectedPlaylistId: string;
  onSelectPlaylist: (id: string) => void;
  onCreatePlaylist: (name: string) => void;
  onExitToRoom: () => void;
}

const tabColors = ["rose", "ochre", "blue", "olive", "parchment"];
const visiblePlaylistLimit = 5;

export function PlaylistPage({
  active,
  playlists,
  songs,
  selectedPlaylistId,
  onSelectPlaylist,
  onCreatePlaylist,
  onExitToRoom
}: PlaylistPageProps) {
  const [showPlaylistIndex, setShowPlaylistIndex] = useState(false);
  const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId) || playlists[0];
  const selectedPlaylistIndex = selectedPlaylist ? playlists.findIndex((playlist) => playlist.id === selectedPlaylist.id) : -1;
  const visiblePlaylistStart = selectedPlaylistIndex >= 0
    ? Math.floor(selectedPlaylistIndex / visiblePlaylistLimit) * visiblePlaylistLimit
    : 0;
  const visiblePlaylists = playlists.slice(visiblePlaylistStart, visiblePlaylistStart + visiblePlaylistLimit);
  const songById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);

  useEffect(() => {
    if (!active) return;
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showPlaylistIndex) {
          setShowPlaylistIndex(false);
          return;
        }
        onExitToRoom();
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [active, onExitToRoom, showPlaylistIndex]);

  function selectPlaylist(id: string) {
    onSelectPlaylist(id);
    setShowPlaylistIndex(false);
  }

  return (
    <main className={`playlist-page ${!active ? "is-inactive" : ""}`} aria-hidden={!active}>
      <button className="playlist-exit-zone" type="button" aria-label="返回房间" onClick={onExitToRoom} />
      <section className="playlist-workspace" aria-label="歌单">
        <div className="playlist-object">
          <img className="playlist-backboard" src={backboardAsset} alt="" draggable={false} />
          <img className="playlist-sheet" src={sheetAsset} alt="" draggable={false} />
          <button
            aria-label="打开歌单目录"
            aria-pressed={showPlaylistIndex}
            className={`playlist-tab playlist-tab-home ${showPlaylistIndex ? "active" : ""}`}
            type="button"
            onClick={() => setShowPlaylistIndex(true)}
          >
            <img src={tabAsset} alt="" draggable={false} />
            <svg className="playlist-tab-home-icon" viewBox="0 0 36 36" aria-hidden="true">
              <path className="playlist-tab-home-roof" d="M10 18.5 18 11l8 7.5" />
              <path className="playlist-tab-home-house" d="M13.5 18v8h9v-8" />
              <path className="playlist-tab-home-door" d="M17 26v-4h2v4" />
            </svg>
          </button>
          {visiblePlaylists.map((playlist, index) => (
            <button
              aria-label={`选择歌单 ${playlist.name}`}
              aria-pressed={!showPlaylistIndex && playlist.id === selectedPlaylist?.id}
              className={`playlist-tab playlist-tab-slot-${index} ${!showPlaylistIndex && playlist.id === selectedPlaylist?.id ? "active" : ""} ${playlist.color || tabColors[(visiblePlaylistStart + index) % tabColors.length]}`}
              key={playlist.id}
              style={{ zIndex: !showPlaylistIndex && playlist.id === selectedPlaylist?.id ? "var(--playlist-layer-tab-active)" : "var(--playlist-layer-tab-rest)" }}
              type="button"
              onClick={() => selectPlaylist(playlist.id)}
            >
              <img src={tabAsset} alt="" draggable={false} />
            </button>
          ))}
          <button
            aria-label="新建歌单"
            className="playlist-tab playlist-tab-create parchment"
            type="button"
            onClick={() => {
              onCreatePlaylist("");
              setShowPlaylistIndex(false);
            }}
          >
            <img src={tabAsset} alt="" draggable={false} />
            <svg className="playlist-tab-create-icon" viewBox="0 0 36 36" aria-hidden="true">
              <circle className="playlist-tab-create-sticker" cx="18" cy="18" r="13" />
              <path className="playlist-tab-create-mark" d="M18.5 10.5c-.5 4.7-.7 9.5-.3 14.7M11.2 18.2c4.7-.5 9.5-.4 14.1.2" />
            </svg>
          </button>
          <img className="playlist-clip" src={clipAsset} alt="" draggable={false} />
          <div className="playlist-paper-content">
            {showPlaylistIndex ? (
              <div className="playlist-index-page">
                <div className="playlist-paper-title">
                  <span>歌单目录</span>
                  <small>{playlists.length} 张</small>
                </div>
                {playlists.length ? (
                  <div className="playlist-index-list">
                    {playlists.map((playlist, index) => (
                      <button
                        className={`playlist-index-row ${playlist.id === selectedPlaylist?.id ? "active" : ""}`}
                        key={playlist.id}
                        type="button"
                        onClick={() => selectPlaylist(playlist.id)}
                      >
                        <i>{String(index + 1).padStart(2, "0")}</i>
                        <span>{playlist.name}</span>
                        <small>{playlist.items.length} 首</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="playlist-paper-empty">还没有歌单</div>
                )}
              </div>
            ) : selectedPlaylist ? (
              <>
                <div className="playlist-paper-title">
                  <span>{selectedPlaylist.name}</span>
                  <small>{selectedPlaylist.items.length} 首</small>
                </div>
                <div className="playlist-paper-lines">
                  {selectedPlaylist.items.slice(0, 8).map((item, index) => {
                    const song = songById.get(item.songId);
                    return (
                      <span className="playlist-paper-line" key={item.id}>
                        <i>{String(index + 1).padStart(2, "0")}</i>
                        <b>{song?.title || "未找到歌曲"}</b>
                      </span>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="playlist-paper-empty">新歌单</div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
