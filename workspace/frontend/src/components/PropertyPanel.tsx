import type { Wall2D, Room2D } from './Canvas2DViewer'
import type { SecurityDevice } from '../stores/editorStore'

type Props = {
  selectedWall: Wall2D | null
  wallIndex: number | null
  wallCount: number
  roomCount: number
  rooms: Room2D[]
  selectedRoomIdx: number | null
  selectedDevice: SecurityDevice | null
  selectedDeviceIdx: number | null
  deviceCount: number
}

const DEVICE_TYPE_LABELS: Record<string, string> = {
  camera: 'Camera', sensor: 'Sensor', alarm: 'Alarm', access: 'Access',
}

export function PropertyPanel({ selectedWall, wallIndex, wallCount, roomCount, rooms, selectedRoomIdx, selectedDevice, selectedDeviceIdx, deviceCount }: Props) {
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
      ) : selectedDevice && selectedDeviceIdx !== null ? (
        <div className="inspector-info">
          <p><span>Type</span> Device</p>
          <p><span>Device</span> {DEVICE_TYPE_LABELS[selectedDevice.device_type] ?? selectedDevice.device_type}</p>
          <p><span>Name</span> {selectedDevice.name}</p>
          <p><span>Pos</span> ({selectedDevice.x.toFixed(2)}, {selectedDevice.y.toFixed(2)})</p>
          <p><span>ID</span> {selectedDevice.id.slice(0, 8)}...</p>
        </div>
      ) : selectedRoom ? (
        <div className="inspector-info">
          <p><span>Type</span> Room</p>
          <p><span>Name</span> {selectedRoom.label ?? '(unnamed)'}</p>
          <p><span>Pos</span> ({selectedRoom.x.toFixed(2)}, {selectedRoom.y.toFixed(2)})</p>
          <p><span>Size</span> {selectedRoom.w.toFixed(2)} x {selectedRoom.h.toFixed(2)} m</p>
          <p><span>Area</span> {(selectedRoom.w * selectedRoom.h).toFixed(2)} m&sup2;</p>
        </div>
      ) : (
        <p className="hint">
          {wallCount > 0 || roomCount > 0 || deviceCount > 0 ? 'Select a wall/room/device.' : 'The drawing is empty.'}
        </p>
      )}

      <div className="inspector-stats">
        <small>Walls: {wallCount}  Rooms: {roomCount}  Devices: {deviceCount}</small>
      </div>
    </aside>
  )
}
