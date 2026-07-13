import { useEffect, useRef, useState } from 'react'

import type { Wall2D, Room2D, WallOpening2D } from './Canvas2DViewer'
import type { SecurityDevice } from '../stores/editorStore'

type Props = {
  language?: 'en' | 'ko'
  selectedWall: Wall2D | null
  wallIndex: number | null
  wallCount: number
  roomCount: number
  rooms: Room2D[]
  selectedRoomIdx: number | null
  selectedDevice: SecurityDevice | null
  selectedDeviceIdx: number | null
  selectedOpening: WallOpening2D | null
  selectedOpeningIdx: number | null
  deviceCount: number
  openingCount?: number
  saveStatus?: 'idle' | 'loading' | 'saving' | 'saved' | 'error'
  onBeginEdit?: () => void
  onUpdateWall?: (idx: number, wall: Partial<Wall2D>, recordHistory?: boolean) => void
  onUpdateRoom?: (idx: number, room: Partial<Room2D>, recordHistory?: boolean) => void
  onUpdateDevice?: (idx: number, device: Partial<SecurityDevice>, recordHistory?: boolean) => void
  onUpdateOpening?: (idx: number, opening: Partial<WallOpening2D>, recordHistory?: boolean) => void
  onDeleteSelected?: () => void
}

const DEVICE_TYPE_LABELS: Record<string, string> = {
  camera: 'Camera', sensor: 'Sensor', alarm: 'Alarm', access: 'Access',
}

const copy = {
  en: {
    title: 'Properties',
    subtitle: 'Edit selected scene object',
    saveStatus: {
      idle: 'Auto-save ready',
      loading: 'Loading saved state',
      saving: 'Saving changes',
      saved: 'Saved',
      error: 'Save failed',
    },
    fields: {
      type: 'Type',
      index: 'Index',
      start: 'Start',
      end: 'End',
      length: 'Length',
      wall: 'Wall',
      position: 'Position',
      width: 'Width',
      device: 'Device',
      name: 'Name',
      pos: 'Pos',
      id: 'ID',
      angle: 'Angle',
      size: 'Size',
      area: 'Area',
      height: 'Height',
      startX: 'Start X',
      startY: 'Start Y',
      endX: 'End X',
      endY: 'End Y',
      x: 'X',
      y: 'Y',
    },
    objectTypes: {
      wall: 'Wall',
      room: 'Room',
      device: 'Device',
      door: 'Door',
      window: 'Window',
      opening: 'Opening',
    },
    delete: {
      wall: 'Delete selected wall',
      opening: 'Delete selected opening',
      device: 'Delete selected device',
      room: 'Delete selected room',
    },
    unnamed: '(unnamed)',
    hintSelect: 'Select a wall/room/opening/device.',
    hintEmpty: 'The drawing is empty.',
    stats: (wallCount: number, roomCount: number, openingCount: number, deviceCount: number) =>
      `Walls: ${wallCount}  Rooms: ${roomCount}  Openings: ${openingCount}  Devices: ${deviceCount}`,
  },
  ko: {
    title: '속성',
    subtitle: '선택한 씬 객체를 편집합니다',
    saveStatus: {
      idle: '자동 저장 준비',
      loading: '저장 상태 불러오는 중',
      saving: '변경 사항 저장 중',
      saved: '저장됨',
      error: '저장 실패',
    },
    fields: {
      type: '유형',
      index: '번호',
      start: '시작점',
      end: '끝점',
      length: '길이',
      wall: '벽',
      position: '위치',
      width: '너비',
      device: '장치',
      name: '이름',
      pos: '좌표',
      id: 'ID',
      angle: '각도',
      size: '크기',
      area: '면적',
      height: '높이',
      startX: '시작 X',
      startY: '시작 Y',
      endX: '끝 X',
      endY: '끝 Y',
      x: 'X',
      y: 'Y',
    },
    objectTypes: {
      wall: '벽',
      room: '방',
      device: '장치',
      door: '문',
      window: '창문',
      opening: '개구부',
    },
    delete: {
      wall: '선택한 벽 삭제',
      opening: '선택한 개구부 삭제',
      device: '선택한 장치 삭제',
      room: '선택한 방 삭제',
    },
    unnamed: '(이름 없음)',
    hintSelect: '벽/방/개구부/장치를 선택하세요.',
    hintEmpty: '도면이 비어 있습니다.',
    stats: (wallCount: number, roomCount: number, openingCount: number, deviceCount: number) =>
      `벽: ${wallCount}  방: ${roomCount}  개구부: ${openingCount}  장치: ${deviceCount}`,
  },
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
  language = 'en',
  selectedWall,
  wallIndex,
  wallCount,
  roomCount,
  rooms,
  selectedRoomIdx,
  selectedDevice,
  selectedDeviceIdx,
  selectedOpening,
  selectedOpeningIdx,
  deviceCount,
  openingCount = 0,
  saveStatus = 'idle',
  onBeginEdit,
  onUpdateWall,
  onUpdateRoom,
  onUpdateDevice,
  onUpdateOpening,
  onDeleteSelected,
}: Props) {
  const t = copy[language]
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
          <strong>{t.title}</strong>
          <span>{t.subtitle}</span>
        </div>
        <small className={`inspector-save-status ${saveStatus}`}>{t.saveStatus[saveStatus]}</small>
      </div>

      {selectedWall && wallIndex !== null ? (
        <div className="inspector-info">
          <p><span>{t.fields.type}</span> {t.objectTypes.wall}</p>
          <p><span>{t.fields.index}</span> #{wallIndex}</p>
          <p><span>{t.fields.start}</span> ({selectedWall.x1.toFixed(2)}, {selectedWall.y1.toFixed(2)})</p>
          <p><span>{t.fields.end}</span> ({selectedWall.x2.toFixed(2)}, {selectedWall.y2.toFixed(2)})</p>
          <p>
            <span>{t.fields.length}</span>{' '}
            {Math.hypot(selectedWall.x2 - selectedWall.x1, selectedWall.y2 - selectedWall.y1).toFixed(2)} m
          </p>
          <div className="inspector-edit-grid">
            <NumberField label={t.fields.startX} value={selectedWall.x1} onBeginEdit={() => beginEdit(`wall-${wallIndex}-x1`)} onEndEdit={endEdit} onChange={(x1) => onUpdateWall?.(wallIndex, { x1 }, false)} />
            <NumberField label={t.fields.startY} value={selectedWall.y1} onBeginEdit={() => beginEdit(`wall-${wallIndex}-y1`)} onEndEdit={endEdit} onChange={(y1) => onUpdateWall?.(wallIndex, { y1 }, false)} />
            <NumberField label={t.fields.endX} value={selectedWall.x2} onBeginEdit={() => beginEdit(`wall-${wallIndex}-x2`)} onEndEdit={endEdit} onChange={(x2) => onUpdateWall?.(wallIndex, { x2 }, false)} />
            <NumberField label={t.fields.endY} value={selectedWall.y2} onBeginEdit={() => beginEdit(`wall-${wallIndex}-y2`)} onEndEdit={endEdit} onChange={(y2) => onUpdateWall?.(wallIndex, { y2 }, false)} />
          </div>
          <button className="inspector-delete-btn" type="button" onClick={onDeleteSelected}>{t.delete.wall}</button>
        </div>
      ) : selectedOpening && selectedOpeningIdx !== null ? (
        <div className="inspector-info">
          <p><span>{t.fields.type}</span> {t.objectTypes[selectedOpening.type]}</p>
          <p><span>{t.fields.index}</span> #{selectedOpeningIdx}</p>
          <p><span>{t.fields.wall}</span> #{selectedOpening.wallIdx}</p>
          <p><span>{t.fields.position}</span> {(selectedOpening.position * 100).toFixed(1)}%</p>
          <p><span>{t.fields.width}</span> {selectedOpening.width.toFixed(2)} m</p>
          <div className="inspector-edit-grid">
            <label className="inspector-field">
              <span>{t.fields.type}</span>
              <select
                value={selectedOpening.type}
                onBlur={endEdit}
                onFocus={() => beginEdit(`opening-${selectedOpeningIdx}-type`)}
                onChange={(event) => onUpdateOpening?.(selectedOpeningIdx, { type: event.target.value as WallOpening2D['type'] }, false)}
              >
                <option value="door">{t.objectTypes.door}</option>
                <option value="window">{t.objectTypes.window}</option>
                <option value="opening">{t.objectTypes.opening}</option>
              </select>
            </label>
            <NumberField label={t.fields.position} value={selectedOpening.position} min={0} step="0.01" onBeginEdit={() => beginEdit(`opening-${selectedOpeningIdx}-position`)} onEndEdit={endEdit} onChange={(position) => onUpdateOpening?.(selectedOpeningIdx, { position: Math.max(0, Math.min(1, position)) }, false)} />
            <NumberField label={t.fields.width} value={selectedOpening.width} min={0.1} onBeginEdit={() => beginEdit(`opening-${selectedOpeningIdx}-width`)} onEndEdit={endEdit} onChange={(width) => onUpdateOpening?.(selectedOpeningIdx, { width }, false)} />
          </div>
          <button className="inspector-delete-btn" type="button" onClick={onDeleteSelected}>{t.delete.opening}</button>
        </div>
      ) : selectedDevice && selectedDeviceIdx !== null ? (
        <div className="inspector-info">
          <p><span>{t.fields.type}</span> {t.objectTypes.device}</p>
          <p><span>{t.fields.device}</span> {DEVICE_TYPE_LABELS[selectedDevice.device_type] ?? selectedDevice.device_type}</p>
          <p><span>{t.fields.name}</span> {selectedDevice.name}</p>
          <p><span>{t.fields.pos}</span> ({selectedDevice.x.toFixed(2)}, {selectedDevice.y.toFixed(2)})</p>
          <p><span>{t.fields.id}</span> {selectedDevice.id.slice(0, 8)}...</p>
          <div className="inspector-edit-grid">
            <label className="inspector-field wide">
              <span>{t.fields.name}</span>
              <input
                value={selectedDevice.name}
                onBlur={endEdit}
                onFocus={() => beginEdit(`device-${selectedDeviceIdx}-name`)}
                onChange={(event) => onUpdateDevice?.(selectedDeviceIdx, { name: event.target.value }, false)}
              />
            </label>
            <label className="inspector-field">
              <span>{t.fields.type}</span>
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
            <NumberField label={t.fields.x} value={selectedDevice.x} onBeginEdit={() => beginEdit(`device-${selectedDeviceIdx}-x`)} onEndEdit={endEdit} onChange={(x) => onUpdateDevice?.(selectedDeviceIdx, { x }, false)} />
            <NumberField label={t.fields.y} value={selectedDevice.y} onBeginEdit={() => beginEdit(`device-${selectedDeviceIdx}-y`)} onEndEdit={endEdit} onChange={(y) => onUpdateDevice?.(selectedDeviceIdx, { y }, false)} />
            <NumberField label={t.fields.angle} value={selectedDevice.angle ?? 0} step="1" onBeginEdit={() => beginEdit(`device-${selectedDeviceIdx}-angle`)} onEndEdit={endEdit} onChange={(angle) => onUpdateDevice?.(selectedDeviceIdx, { angle }, false)} />
          </div>
          <button className="inspector-delete-btn" type="button" onClick={onDeleteSelected}>{t.delete.device}</button>
        </div>
      ) : selectedRoom ? (
        <div className="inspector-info">
          <p><span>{t.fields.type}</span> {t.objectTypes.room}</p>
          <p><span>{t.fields.name}</span> {selectedRoom.label ?? t.unnamed}</p>
          <p><span>{t.fields.pos}</span> ({selectedRoom.x.toFixed(2)}, {selectedRoom.y.toFixed(2)})</p>
          <p><span>{t.fields.size}</span> {selectedRoom.w.toFixed(2)} x {selectedRoom.h.toFixed(2)} m</p>
          <p><span>{t.fields.area}</span> {(selectedRoom.w * selectedRoom.h).toFixed(2)} m&sup2;</p>
          <div className="inspector-edit-grid">
            <label className="inspector-field wide">
              <span>{t.fields.name}</span>
              <input
                value={selectedRoom.label ?? ''}
                onBlur={endEdit}
                onFocus={() => selectedRoomIndex !== null && beginEdit(`room-${selectedRoomIndex}-label`)}
                onChange={(event) => selectedRoomIndex !== null && onUpdateRoom?.(selectedRoomIndex, { label: event.target.value }, false)}
              />
            </label>
            <NumberField label={t.fields.x} value={selectedRoom.x} onBeginEdit={() => selectedRoomIndex !== null && beginEdit(`room-${selectedRoomIndex}-x`)} onEndEdit={endEdit} onChange={(x) => selectedRoomIndex !== null && onUpdateRoom?.(selectedRoomIndex, { x }, false)} />
            <NumberField label={t.fields.y} value={selectedRoom.y} onBeginEdit={() => selectedRoomIndex !== null && beginEdit(`room-${selectedRoomIndex}-y`)} onEndEdit={endEdit} onChange={(y) => selectedRoomIndex !== null && onUpdateRoom?.(selectedRoomIndex, { y }, false)} />
            <NumberField label={t.fields.width} value={selectedRoom.w} min={0.1} onBeginEdit={() => selectedRoomIndex !== null && beginEdit(`room-${selectedRoomIndex}-w`)} onEndEdit={endEdit} onChange={(w) => selectedRoomIndex !== null && onUpdateRoom?.(selectedRoomIndex, { w }, false)} />
            <NumberField label={t.fields.height} value={selectedRoom.h} min={0.1} onBeginEdit={() => selectedRoomIndex !== null && beginEdit(`room-${selectedRoomIndex}-h`)} onEndEdit={endEdit} onChange={(h) => selectedRoomIndex !== null && onUpdateRoom?.(selectedRoomIndex, { h }, false)} />
          </div>
          <button className="inspector-delete-btn" type="button" onClick={onDeleteSelected}>{t.delete.room}</button>
        </div>
      ) : (
        <p className="hint">
          {wallCount > 0 || roomCount > 0 || deviceCount > 0 || openingCount > 0 ? t.hintSelect : t.hintEmpty}
        </p>
      )}

      <div className="inspector-stats">
        <small>{t.stats(wallCount, roomCount, openingCount, deviceCount)}</small>
      </div>
    </aside>
  )
}
