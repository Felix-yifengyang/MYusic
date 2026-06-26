const roomTable = new URL(
  "../assets/images/room/turntable-table.png",
  import.meta.url,
).href;
const roomCabinet = new URL(
  "../assets/images/room/record-cabinet.png",
  import.meta.url,
).href;

interface RoomPageProps {
  active: boolean;
  onEnterTable: () => void;
  onEnterCabinet: () => void;
}

export function RoomPage({ active, onEnterTable, onEnterCabinet }: RoomPageProps) {
  return (
    <main className={`room-page ${!active ? "is-inactive" : ""}`} aria-hidden={!active}>
      <button
        className="room-table-entry"
        type="button"
        aria-label="进入唱片机"
        onClick={onEnterTable}
      >
        <img
          src={roomTable}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      </button>
      <button
        className="room-cabinet-entry"
        type="button"
        aria-label="打开唱片柜"
        onClick={onEnterCabinet}
      >
        <img
          src={roomCabinet}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      </button>
    </main>
  );
}
