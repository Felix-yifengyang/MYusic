const roomTurntableTable = new URL(
  "../assets/images/room/turntable-table.png",
  import.meta.url,
).href;
const roomRecordCabinet = new URL(
  "../assets/images/room/record-cabinet.png",
  import.meta.url,
).href;

interface RoomPageProps {
  active: boolean;
  onEnterDesk: () => void;
}

export function RoomPage({ active, onEnterDesk }: RoomPageProps) {
  return (
    <main className={`room-page ${!active ? "is-inactive" : ""}`} aria-hidden={!active}>
      <button
        className="room-desk-entry"
        type="button"
        aria-label="进入唱片机"
        onClick={onEnterDesk}
      >
        <img
          src={roomTurntableTable}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      </button>
      <img
        className="room-record-cabinet"
        src={roomRecordCabinet}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
    </main>
  );
}
