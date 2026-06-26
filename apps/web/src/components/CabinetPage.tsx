import type { NavidromeSong } from "@myusic/shared";

const cabinetScene = new URL(
  "../assets/images/cabinet/bg-cabinet.png",
  import.meta.url,
).href;

interface CabinetPageProps {
  active: boolean;
  songs: NavidromeSong[];
  currentTrackKey: string;
  onPlay: (song: NavidromeSong) => void;
}

export function CabinetPage({ active, songs, currentTrackKey, onPlay }: CabinetPageProps) {
  const cabinetCells = Array.from({ length: Math.ceil(songs.length / 4) }, (_, index) => songs.slice(index * 4, index * 4 + 4));

  return (
    <main className={`cabinet-page ${!active ? "is-inactive" : ""}`} aria-hidden={!active}>
      <div className="cabinet-scene">
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
                        {song.coverArt ? <img alt="" loading="lazy" src={`/api/navidrome/cover/${encodeURIComponent(song.coverArt)}`} /> : null}
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
    </main>
  );
}
