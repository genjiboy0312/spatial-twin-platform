import { useState } from 'react'
import type { EditMode, SecurityDeviceType } from '../stores/editorStore'
import { useEditorStore } from '../stores/editorStore'

type Props = {
  mode: EditMode
  onChange: (mode: EditMode) => void
  onLoadSample: () => void
  onClear: () => void
  wallCount: number
  deviceType: SecurityDeviceType
  onDeviceTypeChange: (t: SecurityDeviceType) => void
}

const TOOLS: { id: EditMode; label: string; icon: string }[] = [
  { id: 'select', label: '선택', icon: '⬚' },
  { id: 'wall', label: '벽 그리기', icon: '╱' },
  { id: 'device', label: '장비 배치', icon: '◎' },
  { id: 'delete', label: '삭제', icon: '✕' },
]

const DEVICE_TYPE_LABELS: Record<SecurityDeviceType, string> = {
  camera: '카메라',
  sensor: '센서',
  alarm: '알람',
  access: '출입',
}

export function DrawingToolbar({ mode, onChange, onLoadSample, onClear, wallCount, deviceType, onDeviceTypeChange }: Props) {
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const historyIdx = useEditorStore((s) => s.historyIdx)
  const historyLen = useEditorStore((s) => s.history.length)
  const snapMode = useEditorStore((s) => s.snapMode)
  const setSnapMode = useEditorStore((s) => s.setSnapMode)
  const toggleLayer = useEditorStore((s) => s.toggleLayer)
  const visibleLayers = useEditorStore((s) => s.visibleLayers)

  return (
    <div className="drawing-toolbar">
      <div className="drawing-tool-group">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`btn drawing-tool ${mode === tool.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onChange(tool.id)}
            title={tool.label}
          >
            <span className="tool-icon">{tool.icon}</span>
            {tool.label}
          </button>
        ))}
      </div>

      {mode === 'device' && (
      <div className="drawing-tool-group">
        {(Object.keys(DEVICE_TYPE_LABELS) as SecurityDeviceType[]).map((t) => (
          <button
            key={t}
            className={`btn btn-sm ${deviceType === t ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onDeviceTypeChange(t)}
          >
            {DEVICE_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      )}

      <div className="drawing-tool-group">
        <button className="btn btn-secondary" onClick={undo} disabled={historyIdx < 0} title="Undo">
          ↩
        </button>
        <button className="btn btn-secondary" onClick={redo} disabled={historyIdx + 2 >= historyLen} title="Redo">
          ↪
        </button>
      </div>

      <div className="drawing-tool-group">
        <label className="snap-toggle">
          <input
            type="checkbox"
            checked={snapMode !== 'none'}
            onChange={() => setSnapMode(snapMode === 'none' ? 'both' : 'none')}
          />
          <span>스냅</span>
        </label>
      </div>

      <div className="drawing-tool-group layers-group">
        <button
          className={`btn btn-secondary btn-sm ${visibleLayers.walls ? '' : 'dim'}`}
          onClick={() => toggleLayer('walls')}
        >
          벽
        </button>
        <button
          className={`btn btn-secondary btn-sm ${visibleLayers.rooms ? '' : 'dim'}`}
          onClick={() => toggleLayer('rooms')}
        >
          방
        </button>
        <button
          className={`btn btn-secondary btn-sm ${visibleLayers.devices ? '' : 'dim'}`}
          onClick={() => toggleLayer('devices')}
        >
          장비
        </button>
      </div>

      <div className="drawing-tool-group">
        <button className="btn btn-secondary" onClick={onLoadSample}>
          샘플
        </button>
        <button className="btn btn-secondary" onClick={onClear} disabled={wallCount === 0}>
          지우기
        </button>
      </div>
    </div>
  )
}
