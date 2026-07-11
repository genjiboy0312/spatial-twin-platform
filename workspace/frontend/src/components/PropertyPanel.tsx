import { useEffect, useRef, useState } from 'react'

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
  saveStatus?: 'idle' | 'loading' | 'saving' | 'saved' | 'error'
  onBeginEdit?: () => void
  onUpdateWall?: (idx: number, wall: Partial<Wall2D>, recordHistory?: boolean) => void
  onUpdateRoom?: (idx: number, room: Partial<Room2D>, recordHistory?: boolean) => void
  onUpdateDevice?: (idx: number, device: Partial<SecurityDevice>, recordHistory?: boolean) => void
}

const DEVICE_TYPE_LABELS: Record<string, string> = {
  camera: 'Camera', sensor: 'Sensor', alarm: 'Alarm', access: 'Access',
}

const saveStatusLabels = {
  idle: 'Auto-save ready',
  loading: 'Loading saved state',
  saving: 'Saving changes',
  saved: 'Saved',
  error: 'Save failed',
} as const

function numericValue(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function NumberField({
  label,
  value,
  onChange,
  min,
  step = '0.1',
  onBeginEdit,
  onEndEdit,
}: {
  label: string
  value: number
  min?: number
  step?: string
  onBeginEdit?: () => void
  onEndEdit?: () => void
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(Number.isFinite(value) ? value : 0))
  const invalid = numericValue(draft) === null

  useEffect(() => {
    setDraft(String(Number.isFinite(value) ? value : 0))
  }, [value])

  return (
    <label className={`inspector-field ${invalid ? 'invalid' : ''}`}>
      <span>{label}</span>
      <input
        type="number"
        step={step}
        min={min}
        value={draft}
        onFocus={onBeginEdit}
        onChange={(event) => {
          setDraft(event.target.value)
          const next = numericValue(event.target.value)
          if (next !== null && (min === undefined || next >= min)) onChange(next)
        }}
        onBlur={() => {
          onEndEdit?.()
          const next = numericValue(draft)
          if (next === null || (min !== undefined && next < min)) setDraft(String(Number.isFinite(value) ? value : 0))
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
  saveStatus = 'idle',
  onBeginEdit,
  onUpdateWall,
  onUpdateRoom,
  onUpdateDevice,
}: Props) {
  const selectedRoom = selectedRoomIdx != null && selectedRoomIdx < rooms.length ? rooms[selectedRoomIdx] : null
  const selectedRoomIndex = selectedRoomIdx != null && selectedRoomIdx < rooms.length ? selectedRoomIdx : null
  const activeEditKeyRef = useRef<string | null>(null)

  const beginEdit = (key: string) => {
    if (activeEditKeyRef.current === key) return
    activeEditKeyRef.current = key
    onBeginEdit?.()
  }

  const endEdit = () => {
    activeEditKeyRef.current = null
  }

  return (
    <aside className="inspector card">
      <div className="inspector-head">
        <div>
          <strong>Properties</strong>
          <span>Edit selected scene object</span>
        </div>
        <small className={`inspector-save-status ${saveStatus}`}>{saveStatusLabels[saveStatus]}</small>
      </div>

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
            <NumberField label="Start X" value={selectedWall.x1} onBeginEdit={() => beginEdit(`wall-${wallIndex}-x1`)} onEndEdit={endEdit} onChange={(x1) => onUpdateWall?.(wallIndex, { x1 }, false)} />
            <NumberField label="Start Y" value={selectedWall.y1} onBeginEdit={() => beginEdit(`wall-${wallIndex}-y1`)} onEndEdit={endEdit} onChange={(y1) => onUpdateWall?.(wallIndex, { y1 }, false)} />
            <NumberField label="End X" value={selectedWall.x2} onBeginEdit={() => beginEdit(`wall-${wallIndex}-x2`)} onEndEdit={endEdit} onChange={(x2) => onUpdateWall?.(wallIndex, { x2 }, false)} />
            <NumberField label="End Y" value={selectedWall.y2} onBeginEdit={() => beginEdit(`wall-${wallIndex}-y2`)} onEndEdit={endEdit} onChange={(y2) => onUpdateWall?.(wallIndex, { y2 }, false)} />
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
              <input
                value={selectedDevice.name}
                onBlur={endEdit}
                onFocus={() => beginEdit(`device-${selectedDeviceIdx}-name`)}
                onChange={(event) => onUpdateDevice?.(selectedDeviceIdx, { name: event.target.value }, false)}
              />
            </label>
            <label className="inspector-field">
              <span>Type</span>
              <select
                value={selectedDevice.device_type}
                onBlur={endEdit}
                onFocus={() => beginEdit(`device-${selectedDeviceIdx}-type`)}
                onChange={(event) => onUpdateDevice?.(selectedDeviceIdx, { device_type: event.target.value as SecurityDevice['device_type'] }, false)}
              >
                {Object.entries(DEVICE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <NumberField label="X" value={selectedDevice.x} onBeginEdit={() => beginEdit(`device-${selectedDeviceIdx}-x`)} onEndEdit={endEdit} onChange={(x) => onUpdateDevice?.(selectedDeviceIdx, { x }, false)} />
            <NumberField label="Y" value={selectedDevice.y} onBeginEdit={() => beginEdit(`device-${selectedDeviceIdx}-y`)} onEndEdit={endEdit} onChange={(y) => onUpdateDevice?.(selectedDeviceIdx, { y }, false)} />
            <NumberField label="Angle" value={selectedDevice.angle ?? 0} step="1" onBeginEdit={() => beginEdit(`device-${selectedDeviceIdx}-angle`)} onEndEdit={endEdit} onChange={(angle) => onUpdateDevice?.(selectedDeviceIdx, { angle }, false)} />
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
              <input
                value={selectedRoom.label ?? ''}
                onBlur={endEdit}
                onFocus={() => selectedRoomIndex !== null && beginEdit(`room-${selectedRoomIndex}-label`)}
                onChange={(event) => selectedRoomIndex !== null && onUpdateRoom?.(selectedRoomIndex, { label: event.target.value }, false)}
              />
            </label>
            <NumberField label="X" value={selectedRoom.x} onBeginEdit={() => selectedRoomIndex !== null && beginEdit(`room-${selectedRoomIndex}-x`)} onEndEdit={endEdit} onChange={(x) => selectedRoomIndex !== null && onUpdateRoom?.(selectedRoomIndex, { x }, false)} />
            <NumberField label="Y" value={selectedRoom.y} onBeginEdit={() => selectedRoomIndex !== null && beginEdit(`room-${selectedRoomIndex}-y`)} onEndEdit={endEdit} onChange={(y) => selectedRoomIndex !== null && onUpdateRoom?.(selectedRoomIndex, { y }, false)} />
            <NumberField label="Width" value={selectedRoom.w} min={0.1} onBeginEdit={() => selectedRoomIndex !== null && beginEdit(`room-${selectedRoomIndex}-w`)} onEndEdit={endEdit} onChange={(w) => selectedRoomIndex !== null && onUpdateRoom?.(selectedRoomIndex, { w }, false)} />
            <NumberField label="Height" value={selectedRoom.h} min={0.1} onBeginEdit={() => selectedRoomIndex !== null && beginEdit(`room-${selectedRoomIndex}-h`)} onEndEdit={endEdit} onChange={(h) => selectedRoomIndex !== null && onUpdateRoom?.(selectedRoomIndex, { h }, false)} />
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
