import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { NavidromeSong, Playlist } from "@myusic/shared";
import { Button, EmptyState } from "./ui";

const backboardAsset = new URL("../assets/images/playlist/playlist-backboard.png", import.meta.url).href;
const sheetAsset = new URL("../assets/images/playlist/playlist-sheet.png", import.meta.url).href;
const clipAsset = new URL("../assets/images/playlist/playlist-clip.png", import.meta.url).href;
const tabAsset = new URL("../assets/images/playlist/playlist-tab.png", import.meta.url).href;

interface PlaylistPageProps {
  active: boolean;
  playlists: Playlist[];
  songs: NavidromeSong[];
  selectedPlaylistId: string;
  message: string;
  onSelectPlaylist: (id: string) => void;
  onCreatePlaylist: (name: string) => void;
  onRenamePlaylist: (id: string, name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onPlayPlaylist: (id: string) => void;
  onRemoveItem: (playlistId: string, itemId: string) => void;
  onExitToRoom: () => void;
}

const tabColors = ["rose", "ochre", "blue", "olive", "parchment"];

export function PlaylistPage({
  active,
  playlists,
  songs,
  selectedPlaylistId,
  message,
  onSelectPlaylist,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onPlayPlaylist,
  onRemoveItem,
  onExitToRoom
}: PlaylistPageProps) {
  const [draftName, setDraftName] = useState("");
  const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId) || playlists[0];
  const songById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);

  useEffect(() => {
    if (!active) return;
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExitToRoom();
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [active, onExitToRoom]);

  useEffect(() => {
    setDraftName(selectedPlaylist?.name || "");
  }, [selectedPlaylist?.id, selectedPlaylist?.name]);

  function submitCreate(event: FormEvent) {
    event.preventDefault();
    onCreatePlaylist("");
  }

  function submitRename(event: FormEvent) {
    event.preventDefault();
    if (!selectedPlaylist) return;
    onRenamePlaylist(selectedPlaylist.id, draftName);
  }

  return (
    <main className={`playlist-page ${!active ? "is-inactive" : ""}`} aria-hidden={!active}>
      <button className="playlist-exit-zone" type="button" aria-label="返回房间" onClick={onExitToRoom} />
      <section className="playlist-workspace" aria-label="歌单">
        <div className="playlist-object">
          <img className="playlist-backboard" src={backboardAsset} alt="" draggable={false} />
          <img className="playlist-sheet" src={sheetAsset} alt="" draggable={false} />
          {playlists.slice(0, 8).map((playlist, index) => (
            <button
              aria-label={`选择歌单 ${playlist.name}`}
              aria-pressed={playlist.id === selectedPlaylist?.id}
              className={`playlist-tab ${playlist.id === selectedPlaylist?.id ? "active" : ""} ${playlist.color || tabColors[index % tabColors.length]}`}
              key={playlist.id}
              style={{ top: `${26 + index * 8}%` }}
              type="button"
              onClick={() => onSelectPlaylist(playlist.id)}
            >
              <img src={tabAsset} alt="" draggable={false} />
            </button>
          ))}
          <img className="playlist-clip" src={clipAsset} alt="" draggable={false} />
          <div className="playlist-paper-content">
            {selectedPlaylist ? (
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

        <aside className="playlist-panel">
          <div className="playlist-panel-heading">
            <h2>歌单</h2>
            <form onSubmit={submitCreate}>
              <Button type="submit" size="compact">新建</Button>
            </form>
          </div>
          {message ? <p className="playlist-message">{message}</p> : null}

          {!selectedPlaylist ? (
            <EmptyState>还没有歌单</EmptyState>
          ) : (
            <>
              <form className="playlist-name-form" onSubmit={submitRename}>
                <input
                  aria-label="歌单名"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                />
                <Button type="submit" size="compact">保存</Button>
              </form>

              <div className="playlist-actions">
                <Button type="button" onClick={() => onPlayPlaylist(selectedPlaylist.id)} disabled={!selectedPlaylist.items.length}>播放</Button>
                <Button variant="secondary" type="button" onClick={() => onDeletePlaylist(selectedPlaylist.id)}>删除</Button>
              </div>

              <div className="playlist-track-list">
                {selectedPlaylist.items.length ? selectedPlaylist.items.map((item, index) => {
                  const song = songById.get(item.songId);
                  return (
                    <article className="playlist-track-row" key={item.id}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{song?.title || "未找到歌曲"}</strong>
                        <small>{song?.artist || "Unknown"}</small>
                      </div>
                      <Button variant="secondary" size="compact" type="button" onClick={() => onRemoveItem(selectedPlaylist.id, item.id)}>
                        移除
                      </Button>
                    </article>
                  );
                }) : <EmptyState>从唱片柜把歌曲加入这里</EmptyState>}
              </div>
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
