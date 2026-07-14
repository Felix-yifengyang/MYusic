import { useEffect, useMemo, useRef, useState } from "react";
import type { NavidromeSong, Playlist } from "@myusic/shared";
import { coverUrl } from "./playerTypes";

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
  onRenamePlaylist: (playlistId: string, name: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onPlaySong: (playlist: Playlist, songId: string) => void;
  onRemoveSong: (playlistId: string, songId: string) => void;
  onExitToRoom: () => void;
}

const tabColors = ["rose", "ochre", "blue", "olive", "parchment"];
const visiblePlaylistLimit = 5;
const songPageLimit = 8;

export function PlaylistPage({
  active,
  playlists,
  songs,
  selectedPlaylistId,
  onSelectPlaylist,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onPlaySong,
  onRemoveSong,
  onExitToRoom
}: PlaylistPageProps) {
  const [showPlaylistIndex, setShowPlaylistIndex] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [songPage, setSongPage] = useState(0);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const isEditing = editingName !== null;
  const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId) || playlists[0];
  const selectedPlaylistIndex = selectedPlaylist ? playlists.findIndex((playlist) => playlist.id === selectedPlaylist.id) : -1;
  const visiblePlaylistStart = selectedPlaylistIndex >= 0
    ? Math.floor(selectedPlaylistIndex / visiblePlaylistLimit) * visiblePlaylistLimit
    : 0;
  const visiblePlaylists = playlists.slice(visiblePlaylistStart, visiblePlaylistStart + visiblePlaylistLimit);
  const songById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);
  const songPageCount = Math.ceil((selectedPlaylist?.songIds.length || 0) / songPageLimit);
  const visibleSongIds = selectedPlaylist?.songIds.slice(songPage * songPageLimit, (songPage + 1) * songPageLimit) || [];

  useEffect(() => setSongPage(0), [selectedPlaylist?.id]);

  useEffect(() => {
    setSongPage((current) => Math.min(current, Math.max(songPageCount - 1, 0)));
  }, [songPageCount]);

  useEffect(() => {
    if (!isEditing) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [isEditing]);

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
    setEditingName(null);
    setShowPlaylistIndex(false);
  }

  function saveName() {
    if (!selectedPlaylist || editingName === null) return;
    const name = editingName.trim();
    setEditingName(null);
    if (name && name !== selectedPlaylist.name) onRenamePlaylist(selectedPlaylist.id, name);
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
              className={`playlist-tab playlist-tab-slot-${index} ${!showPlaylistIndex && playlist.id === selectedPlaylist?.id ? "active" : ""} ${tabColors[(visiblePlaylistStart + index) % tabColors.length]}`}
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
            {!selectedPlaylist ? (
              <div className="playlist-paper-empty">无歌单</div>
            ) : showPlaylistIndex ? (
              <>
                <div className="playlist-paper-title">
                  <span>歌单目录</span>
                  <small>{playlists.length} 张</small>
                </div>
                <div className="playlist-paper-lines playlist-index-list">
                  {playlists.map((playlist) => {
                    const coverSong = songById.get(playlist.songIds.find((songId) => songById.has(songId)) || "");
                    return (
                      <div className="playlist-paper-entry" key={playlist.id}>
                        <button
                          className="playlist-paper-entry-main"
                          type="button"
                          onClick={() => selectPlaylist(playlist.id)}
                        >
                          <span className="playlist-paper-cover" aria-hidden="true">
                            {coverSong?.coverArt ? <img src={coverUrl(coverSong)} alt="" loading="lazy" /> : null}
                          </span>
                          <span className="playlist-paper-entry-copy">
                            <b className="playlist-paper-entry-title">{playlist.name}</b>
                            <small>{playlist.songIds.length} 首</small>
                          </span>
                        </button>
                        <button
                          className="playlist-paper-action playlist-paper-entry-remove"
                          type="button"
                          aria-label={`删除歌单 ${playlist.name}`}
                          title="删除歌单"
                          onClick={() => {
                            if (window.confirm(`确定删除歌单“${playlist.name}”吗？`)) {
                              onDeletePlaylist(playlist.id);
                            }
                          }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="playlist-paper-title">
                  <div className={`playlist-paper-title-field ${isEditing ? "is-editing" : ""}`}>
                    <input
                      ref={nameInputRef}
                      className="playlist-paper-title-name"
                      value={editingName ?? selectedPlaylist.name}
                      size={Math.max((editingName ?? selectedPlaylist.name).length, 1)}
                      maxLength={80}
                      readOnly={!isEditing}
                      tabIndex={isEditing ? 0 : -1}
                      aria-label={isEditing ? "歌单名称" : `重命名歌单 ${selectedPlaylist.name}`}
                      onChange={(event) => setEditingName(event.target.value)}
                      onBlur={saveName}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") {
                          event.stopPropagation();
                          setEditingName(null);
                        }
                      }}
                    />
                    {!isEditing ? (
                      <button
                        className="playlist-paper-action playlist-paper-title-edit"
                        type="button"
                        aria-label={`编辑歌单名称 ${selectedPlaylist.name}`}
                        title="编辑歌单名称"
                        onClick={() => setEditingName(selectedPlaylist.name)}
                      >
                        ✎
                      </button>
                    ) : null}
                  </div>
                  <small>{selectedPlaylist.songIds.length} 首</small>
                </div>
                <div className="playlist-paper-lines">
                  {visibleSongIds.map((songId) => {
                    const song = songById.get(songId);
                    const title = song?.title || "未找到歌曲";
                    return (
                      <span className="playlist-paper-entry" key={songId}>
                        <button
                          className="playlist-paper-entry-main"
                          type="button"
                          disabled={!song}
                          onClick={() => onPlaySong(selectedPlaylist, songId)}
                        >
                          <span className="playlist-paper-cover" aria-hidden="true">
                            {song?.coverArt ? <img src={coverUrl(song)} alt="" loading="lazy" /> : null}
                          </span>
                          <span className="playlist-paper-entry-copy">
                            <b className="playlist-paper-entry-title">{title}</b>
                          </span>
                        </button>
                        <button
                          className="playlist-paper-action playlist-paper-entry-remove"
                          type="button"
                          aria-label={`从歌单移除 ${title}`}
                          onClick={() => onRemoveSong(selectedPlaylist.id, songId)}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
                {songPageCount > 1 ? (
                  <nav className="playlist-paper-pagination" aria-label="歌单分页">
                    <button
                      className="playlist-paper-page-prev"
                      type="button"
                      aria-label="上一页"
                      disabled={songPage === 0}
                      onClick={() => setSongPage((current) => current - 1)}
                    >
                      ‹
                    </button>
                    <button
                      className="playlist-paper-page-next"
                      type="button"
                      aria-label="下一页"
                      disabled={songPage === songPageCount - 1}
                      onClick={() => setSongPage((current) => current + 1)}
                    >
                      ›
                    </button>
                  </nav>
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
