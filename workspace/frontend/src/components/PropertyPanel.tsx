import type { Wall2D, Room2D } from './Canvas2DViewer'

type Props = {
  selectedWall: Wall2D | null
  wallIndex: number | null
  wallCount: number
  roomCount: number
  rooms: Room2D[]
  selectedRoomIdx: number | null
}

export function PropertyPanel({ selectedWall, wallIndex, wallCount, roomCount, rooms, selectedRoomIdx }: Props) {
  const selectedRoom = selectedRoomIdx != null && selectedRoomIdx < rooms.length ? rooms[selectedRoomIdx] : null

  return (
    <aside className="inspector card">
      <strong>Properties</strong>

      {selectedWall && wallIndex !== null ? (
        <div className="inspector-info">
          <p><span>Type</span> Wall</p>
          <p><span>Index</span> #{wallIndex}</p>
          <p><span>Start</span> ({selectedWall.x1.toFixed(2)}, {selectedWall.y1.toFixed(2)})</p>
          <p><span>End</span> ({selectedWall.x2.toFixed(2)}, {selectedWall.y2.toFixed(2)})</p>
          <p>
            <span>Length</span>{' '}
            {Math.hypot(selectedWall.x2 - selectedWall.x1, selectedWall.y2 - selectedWall.y1).toFixed(2)} m
          </p>
        </div>
      ) : selectedRoom ? (
        <div className="inspector-info">
          <p><span>Type</span> Room</p>
          <p><span>Name</span> {selectedRoom.label ?? '(unnamed)'}</p>
          <p><span>Pos</span> ({selectedRoom.x.toFixed(2)}, {selectedRoom.y.toFixed(2)})</p>
          <p><span>Size</span> {selectedRoom.w.toFixed(2)} x {selectedRoom.h.toFixed(2)} m</p>
          <p><span>Area</span> {(selectedRoom.w * selectedRoom.h).toFixed(2)} m²</p>
        </div>
      ) : (
        <p className="hint">
          {wallCount > 0 || roomCount > 0 ? '벽이나 영역을 선택하세요.' : '도면이 비어 있습니다.'}
        </p>
      )}

      <div className="inspector-stats">
        <small>벽 {wallCount}개 · 영역 {roomCount}개</small>
      </div>
    </aside>
  )
}
