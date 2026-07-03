import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent as ReactMouseEvent } from "react";
import type { NavidromeSong, Playlist } from "@myusic/shared";
import { coverUrl } from "./playerTypes";
import { Button } from "./ui";

const cabinetScene = new URL(
  "../assets/images/cabinet/bg-cabinet.png",
  import.meta.url,
).href;

const paginationPrev = new URL(
  "../assets/images/cabinet/cabinet-pagination-prev.png",
  import.meta.url,
).href;

const paginationNext = new URL(
  "../assets/images/cabinet/cabinet-pagination-next.png",
  import.meta.url,
).href;

const SONGS_PER_CELL = 4;
const CELLS_PER_PAGE = 10;
const SONGS_PER_PAGE = SONGS_PER_CELL * CELLS_PER_PAGE;

interface CabinetPageProps {
  active: boolean;
  songs: NavidromeSong[];
  playlists: Playlist[];
  selectedPlaylistId: string;
  currentTrackKey: string;
  onPlay: (song: NavidromeSong) => void;
  onAddToPlaylist: (song: NavidromeSong, playlistId?: string, playlistName?: string) => void;
  onDeleteSong: (song: NavidromeSong) => void;
  onExitToRoom: () => void;
}

export function CabinetPage({
  active,
  songs,
  playlists,
  selectedPlaylistId,
  currentTrackKey,
  onPlay,
  onAddToPlaylist,
  onDeleteSong,
  onExitToRoom
}: CabinetPageProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [recordMenu, setRecordMenu] = useState<{ song: NavidromeSong; x: number; y: number } | null>(null);
  const [modalSong, setModalSong] = useState<NavidromeSong | null>(null);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [createFlag, setCreateFlag] = useState(false);
  const [newName, setNewName] = useState("");
  const recordMenuRef = useRef<HTMLDivElement | null>(null);
  const modalDialogRef = useRef<HTMLDialogElement | null>(null);
  const pageCount = Math.max(1, Math.ceil(songs.length / SONGS_PER_PAGE));
  const currentPageIndex = Math.min(pageIndex, pageCount - 1);
  const pageSongs = songs.slice(currentPageIndex * SONGS_PER_PAGE, (currentPageIndex + 1) * SONGS_PER_PAGE);
  const cabinetCells = Array.from(
    { length: Math.ceil(pageSongs.length / SONGS_PER_CELL) },
    (_, index) => pageSongs.slice(index * SONGS_PER_CELL, index * SONGS_PER_CELL + SONGS_PER_CELL),
  );
  const hasPreviousPage = currentPageIndex > 0;
  const hasNextPage = currentPageIndex < pageCount - 1;
  const showPagination = pageCount > 1;

  useEffect(() => {
    if (!active) return;

    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && modalSong) {
        event.preventDefault();
        closePlaylistModal();
        return;
      }

      if (event.key === "Escape" && recordMenu) {
        event.preventDefault();
        setRecordMenu(null);
        return;
      }

      if (event.key === "Escape") onExitToRoom();
      if (event.key === "ArrowLeft" && hasPreviousPage) {
        event.preventDefault();
        setPageIndex((index) => Math.max(0, index - 1));
      }
      if (event.key === "ArrowRight" && hasNextPage) {
        event.preventDefault();
        setPageIndex((index) => Math.min(pageCount - 1, index + 1));
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [active, hasNextPage, hasPreviousPage, modalSong, onExitToRoom, pageCount, recordMenu]);

  useEffect(() => {
    if (!recordMenu) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (recordMenuRef.current?.contains(event.target as Node)) return;
      setRecordMenu(null);
    };
    const closeMenu = () => setRecordMenu(null);

    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [recordMenu]);

  useEffect(() => {
    if (pageIndex >= pageCount) setPageIndex(pageCount - 1);
  }, [pageCount, pageIndex]);

  function openRecordMenu(song: NavidromeSong, x: number, y: number) {
    const menuWidth = 184;
    const menuHeight = 56;
    setRecordMenu({
      song,
      x: Math.max(12, Math.min(x, window.innerWidth - menuWidth - 12)),
      y: Math.max(12, Math.min(y, window.innerHeight - menuHeight - 12))
    });
  }

  function handleRecordRightClick(event: ReactMouseEvent, song: NavidromeSong) {
    event.preventDefault();
    event.stopPropagation();
    openRecordMenu(song, event.clientX, event.clientY);
  }

  function openPlaylistModal(song: NavidromeSong) {
    setRecordMenu(null);
    setModalSong(song);
    const addedIds: string[] = [];
    for (const playlist of playlists) {
      if (hasSong(playlist, song.id)) addedIds.push(playlist.id);
    }
    const fallbackId = playlists.some((playlist) => playlist.id === selectedPlaylistId)
      ? selectedPlaylistId
      : playlists[0]?.id;

    setPickedIds(addedIds.length ? addedIds : fallbackId ? [fallbackId] : []);
    setCreateFlag(false);
    setNewName("");
    queueMicrotask(() => {
      if (!modalDialogRef.current?.open) modalDialogRef.current?.showModal();
    });
  }

  function closePlaylistModal() {
    if (modalDialogRef.current?.open) modalDialogRef.current.close();
    setModalSong(null);
    setPickedIds([]);
    setCreateFlag(false);
    setNewName("");
  }

  function confirmAddToPlaylist() {
    if (!modalSong) return;
    const ids = pickedIds.filter((playlistId) => {
      const playlist = playlists.find((item) => item.id === playlistId);
      return playlist && !hasSong(playlist, modalSong.id);
    });
    if (!ids.length) return;
    ids.forEach((playlistId) => onAddToPlaylist(modalSong, playlistId));
    closePlaylistModal();
  }

  function submitNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modalSong) return;
    onAddToPlaylist(modalSong, undefined, newName.trim());
    closePlaylistModal();
  }

  function togglePick(playlistId: string) {
    setPickedIds((current) => (
      current.includes(playlistId)
        ? current.filter((id) => id !== playlistId)
        : [...current, playlistId]
    ));
  }

  function confirmDeleteSong(song: NavidromeSong) {
    setRecordMenu(null);
    if (window.confirm(`删除“${song.title}”？`)) onDeleteSong(song);
  }

  return (
    <main className={`cabinet-page ${!active ? "is-inactive" : ""}`} aria-hidden={!active}>
      <button
        className="cabinet-exit-zone"
        type="button"
        aria-label="返回房间"
        onClick={onExitToRoom}
      />
      {showPagination ? (
        <>
          <button
            className="cabinet-pagination-button cabinet-pagination-prev"
            type="button"
            aria-label="上一页唱片"
            disabled={!hasPreviousPage}
            onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
          >
            <img src={paginationPrev} alt="" aria-hidden="true" draggable={false} />
          </button>
          <button
            className="cabinet-pagination-button cabinet-pagination-next"
            type="button"
            aria-label="下一页唱片"
            disabled={!hasNextPage}
            onClick={() => setPageIndex((index) => Math.min(pageCount - 1, index + 1))}
          >
            <img src={paginationNext} alt="" aria-hidden="true" draggable={false} />
          </button>
        </>
      ) : null}
      <div className="cabinet-scene">
        <div className="cabinet-board">
          <img
            className="cabinet-image"
            src={cabinetScene}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <div className="cabinet-cell-grid" aria-label="音乐库">
            {cabinetCells.map((cellSongs, cellIndex) => (
              <div className="cabinet-cell" key={cellIndex}>
                {cellSongs.map((song) => {
                  const trackKey = `navidrome:${song.id}`;
                  return (
                    <div
                      className={`cabinet-record-slot ${currentTrackKey === trackKey ? "is-current" : ""}`}
                      key={song.id}
                      onContextMenu={(event) => handleRecordRightClick(event, song)}
                    >
                      <button
                        className="cabinet-record-button"
                        type="button"
                        aria-label={`播放 ${song.title}`}
                        aria-pressed={currentTrackKey === trackKey}
                        onClick={() => onPlay(song)}
                        title={`${song.title}${song.artist ? ` - ${song.artist}` : ""}`}
                      >
                        <span className="vinyl-record cabinet-record">
                          <span className="vinyl-record-disc" aria-hidden="true" />
                          <span className="vinyl-record-label">
                            {song.coverArt ? <img alt="" loading="lazy" src={coverUrl(song)} /> : null}
                          </span>
                          <span className="vinyl-record-hole" aria-hidden="true" />
                        </span>
                        <span className="cabinet-record-title">{song.title}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {recordMenu ? (
        <div
          className="cabinet-context-menu"
          ref={recordMenuRef}
          role="menu"
          style={{ left: recordMenu.x, top: recordMenu.y }}
        >
          <button type="button" role="menuitem" onClick={() => openPlaylistModal(recordMenu.song)}>
            加入歌单
          </button>
          <button className="danger" type="button" role="menuitem" onClick={() => confirmDeleteSong(recordMenu.song)}>
            删除歌曲
          </button>
        </div>
      ) : null}
      <dialog
        className="cabinet-playlist-modal"
        ref={modalDialogRef}
        aria-labelledby="cabinet-playlist-modal-title"
        onClose={() => {
          setModalSong(null);
          setPickedIds([]);
          setCreateFlag(false);
          setNewName("");
        }}
      >
        {modalSong ? (
          <>
            <div className="cabinet-playlist-modal-header">
              <h2 id="cabinet-playlist-modal-title">添加到歌单</h2>
              <button className="cabinet-playlist-modal-close" type="button" aria-label="关闭" onClick={closePlaylistModal}>
                ×
              </button>
            </div>

            <div className="cabinet-playlist-modal-body">
              {playlists.length ? (
                <div className="cabinet-playlist-list" role="group" aria-label="选择歌单">
                  {playlists.map((playlist) => (
                    <label
                      className={`cabinet-playlist-option ${hasSong(playlist, modalSong.id) ? "is-added" : ""}`}
                      key={playlist.id}
                    >
                      <input
                        type="checkbox"
                        checked={pickedIds.includes(playlist.id)}
                        disabled={hasSong(playlist, modalSong.id)}
                        onChange={() => togglePick(playlist.id)}
                      />
                      <span className="cabinet-playlist-option-check" aria-hidden="true" />
                      <span className="cabinet-playlist-option-name">
                        {playlist.name}
                        {hasSong(playlist, modalSong.id) ? <small>已加入</small> : null}
                      </span>
                      <span className="cabinet-playlist-option-count">{playlist.items.length}/1000</span>
                    </label>
                  ))}
                </div>
              ) : null}

              <div className={`cabinet-playlist-create-box ${createFlag ? "is-open" : ""}`}>
                {createFlag ? (
                  <form className="cabinet-playlist-create-form" onSubmit={submitNew}>
                    <input
                      aria-label="新建歌单名称"
                      maxLength={20}
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      placeholder="最多可输入20个字"
                    />
                    <button type="submit">新建</button>
                  </form>
                ) : (
                  <button
                    className="cabinet-playlist-create-toggle"
                    type="button"
                    aria-expanded={createFlag}
                    onClick={() => setCreateFlag(true)}
                  >
                    <span className="cabinet-playlist-create-plus" aria-hidden="true" />
                    <span>新建歌单</span>
                  </button>
                )}
              </div>
            </div>

            <div className="cabinet-playlist-modal-actions">
              <Button
                className="cabinet-playlist-confirm"
                type="button"
                disabled={!modalSong || !pickedIds.some((playlistId) => {
                  const playlist = playlists.find((item) => item.id === playlistId);
                  return playlist && !hasSong(playlist, modalSong.id);
                })}
                onClick={confirmAddToPlaylist}
              >
                确定
              </Button>
            </div>
          </>
        ) : null}
      </dialog>
    </main>
  );
}

function hasSong(playlist: Playlist, songId: string) {
  return playlist.items.some((item) => item.songId === songId);
}
