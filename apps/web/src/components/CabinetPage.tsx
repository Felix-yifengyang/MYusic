import { useEffect, useState } from "react";
import type { NavidromeSong } from "@myusic/shared";
import { coverUrl } from "./playerTypes";

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
  currentTrackKey: string;
  onPlay: (song: NavidromeSong) => void;
  onExitToRoom: () => void;
}

export function CabinetPage({ active, songs, currentTrackKey, onPlay, onExitToRoom }: CabinetPageProps) {
  const [pageIndex, setPageIndex] = useState(0);
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
  }, [active, hasNextPage, hasPreviousPage, onExitToRoom, pageCount]);

  useEffect(() => {
    if (pageIndex >= pageCount) setPageIndex(pageCount - 1);
  }, [pageCount, pageIndex]);

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
                    <button
                      className={`cabinet-record-button ${currentTrackKey === trackKey ? "is-current" : ""}`}
                      type="button"
                      key={song.id}
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
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
