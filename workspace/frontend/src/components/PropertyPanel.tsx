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
  onUpdateWall?: (idx: number, wall: Partial<Wall2D>) => void
  onUpdateRoom?: (idx: number, room: Partial<Room2D>) => void
  onUpdateDevice?: (idx: number, device: Partial<SecurityDevice>) => void
}

const DEVICE_TYPE_LABELS: Record<string, string> = {
  camera: 'Camera', sensor: 'Sensor', alarm: 'Alarm', access: 'Access',
}

function numericValue(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="inspector-field">
      <span>{label}</span>
      <input
        type="number"
        step="0.1"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => {
          const next = numericValue(event.target.value)
          if (next !== null) onChange(next)
        }}
      />
    </label>
  )
}

export function PropertyPanel({
  selectedWall,
  wallIndex,
  wallCount,
  roomCount,
  rooms,
  selectedRoomIdx,
  selectedDevice,
  selectedDeviceIdx,
  deviceCount,
  onUpdateWall,
  onUpdateRoom,
  onUpdateDevice,
}: Props) {
  const selectedRoom = selectedRoomIdx != null && selectedRoomIdx < rooms.length ? rooms[selectedRoomIdx] : null
  const selectedRoomIndex = selectedRoomIdx != null && selectedRoomIdx < rooms.length ? selectedRoomIdx : null

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
          <div className="inspector-edit-grid">
            <NumberField label="Start X" value={selectedWall.x1} onChange={(x1) => onUpdateWall?.(wallIndex, { x1 })} />
            <NumberField label="Start Y" value={selectedWall.y1} onChange={(y1) => onUpdateWall?.(wallIndex, { y1 })} />
            <NumberField label="End X" value={selectedWall.x2} onChange={(x2) => onUpdateWall?.(wallIndex, { x2 })} />
            <NumberField label="End Y" value={selectedWall.y2} onChange={(y2) => onUpdateWall?.(wallIndex, { y2 })} />
          </div>
        </div>
      ) : selectedDevice && selectedDeviceIdx !== null ? (
        <div className="inspector-info">
          <p><span>Type</span> Device</p>
          <p><span>Device</span> {DEVICE_TYPE_LABELS[selectedDevice.device_type] ?? selectedDevice.device_type}</p>
          <p><span>Name</span> {selectedDevice.name}</p>
          <p><span>Pos</span> ({selectedDevice.x.toFixed(2)}, {selectedDevice.y.toFixed(2)})</p>
          <p><span>ID</span> {selectedDevice.id.slice(0, 8)}...</p>
          <div className="inspector-edit-grid">
            <label className="inspector-field wide">
              <span>Name</span>
              <input value={selectedDevice.name} onChange={(event) => onUpdateDevice?.(selectedDeviceIdx, { name: event.target.value })} />
            </label>
            <label className="inspector-field">
              <span>Type</span>
              <select
                value={selectedDevice.device_type}
                onChange={(event) => onUpdateDevice?.(selectedDeviceIdx, { device_type: event.target.value as SecurityDevice['device_type'] })}
              >
                {Object.entries(DEVICE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <NumberField label="X" value={selectedDevice.x} onChange={(x) => onUpdateDevice?.(selectedDeviceIdx, { x })} />
            <NumberField label="Y" value={selectedDevice.y} onChange={(y) => onUpdateDevice?.(selectedDeviceIdx, { y })} />
            <NumberField label="Angle" value={selectedDevice.angle ?? 0} onChange={(angle) => onUpdateDevice?.(selectedDeviceIdx, { angle })} />
          </div>
        </div>
      ) : selectedRoom ? (
        <div className="inspector-info">
          <p><span>Type</span> Room</p>
          <p><span>Name</span> {selectedRoom.label ?? '(unnamed)'}</p>
          <p><span>Pos</span> ({selectedRoom.x.toFixed(2)}, {selectedRoom.y.toFixed(2)})</p>
          <p><span>Size</span> {selectedRoom.w.toFixed(2)} x {selectedRoom.h.toFixed(2)} m</p>
          <p><span>Area</span> {(selectedRoom.w * selectedRoom.h).toFixed(2)} m&sup2;</p>
          <div className="inspector-edit-grid">
            <label className="inspector-field wide">
              <span>Name</span>
              <input value={selectedRoom.label ?? ''} onChange={(event) => selectedRoomIndex !== null && onUpdateRoom?.(selectedRoomIndex, { label: event.target.value })} />
            </label>
            <NumberField label="X" value={selectedRoom.x} onChange={(x) => selectedRoomIndex !== null && onUpdateRoom?.(selectedRoomIndex, { x })} />
            <NumberField label="Y" value={selectedRoom.y} onChange={(y) => selectedRoomIndex !== null && onUpdateRoom?.(selectedRoomIndex, { y })} />
            <NumberField label="Width" value={selectedRoom.w} onChange={(w) => selectedRoomIndex !== null && onUpdateRoom?.(selectedRoomIndex, { w })} />
            <NumberField label="Height" value={selectedRoom.h} onChange={(h) => selectedRoomIndex !== null && onUpdateRoom?.(selectedRoomIndex, { h })} />
          </div>
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
