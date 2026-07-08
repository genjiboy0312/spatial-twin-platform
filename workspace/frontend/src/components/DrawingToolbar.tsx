import { useState } from 'react'
import { useEditorStore } from '../stores/editorStore'
import type { EditMode, SecurityDeviceType } from '../stores/editorStore'
import { DEVICE_TYPE_LABELS } from '../constants/devices'
import {
  MousePointer2,
  Pencil,
  Square,
  DoorOpen,
  AppWindow,
  SquareDashed,
  Trash2,
  Crosshair,
  ChevronLeft,
  ChevronRight,
} from './Icons'

type Props = {
  mode: EditMode
  onChange: (mode: EditMode) => void
  onLoadSample: () => void
  onClear: () => void
  wallCount: number
  deviceType: SecurityDeviceType
  onDeviceTypeChange: (t: SecurityDeviceType) => void
}

type ToolDef = {
  id: EditMode
  label: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
  shortcut: string
}

const DRAW_TOOLS: ToolDef[] = [
  { id: 'select', label: '선택', Icon: MousePointer2, shortcut: 'S' },
  { id: 'wall', label: '벽', Icon: Pencil, shortcut: 'W' },
  { id: 'room', label: '공간', Icon: Square, shortcut: 'R' },
  { id: 'door', label: '문', Icon: DoorOpen, shortcut: 'D' },
  { id: 'window', label: '창', Icon: AppWindow, shortcut: 'O' },
  { id: 'opening', label: '개구부', Icon: SquareDashed, shortcut: 'P' },
]

const TOOLS_META: ToolDef[] = [
  { id: 'delete', label: '삭제', Icon: Trash2, shortcut: 'X' },
  { id: 'device', label: '장치', Icon: Crosshair, shortcut: 'V' },
]

export function DrawingToolbar({ mode, onChange, onLoadSample, onClear, wallCount, deviceType, onDeviceTypeChange }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="drawing-floating-panel">
      <button
        className="drawing-floating-toggle"
        onClick={() => setCollapsed((v) => !v)}
        title={collapsed ? '펼치기' : '접기'}
        type="button"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className="drawing-floating-slider-wrap">
        <div
          className="drawing-floating-slider"
          style={{
            transform: collapsed ? 'translateX(-100%)' : 'translateX(0)',
            opacity: collapsed ? 0 : 1,
            pointerEvents: collapsed ? ('none' as const) : ('auto' as const),
            transition: 'transform 0.28s ease, opacity 0.2s ease',
          }}
        >
          <div className="drawing-floating-panel-inner">
            {/* Draw tools */}
            <div className="drawing-tool-group">
              {DRAW_TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  className={'drawing-tool-btn' + (mode === tool.id ? ' active' : '')}
                  onClick={() => onChange(tool.id)}
                  title={tool.label + ' (' + tool.shortcut + ')'}
                  type="button"
                >
                  <tool.Icon size={16} />
                </button>
              ))}
            </div>

            <div className="drawing-tool-divider" />

            {/* Action tools */}
            <div className="drawing-tool-group">
              {TOOLS_META.map((tool) => (
                <button
                  key={tool.id}
                  className={'drawing-tool-btn' + (mode === tool.id ? ' active' : '')}
                  onClick={() => onChange(tool.id)}
                  title={tool.label + ' (' + tool.shortcut + ')'}
                  type="button"
                >
                  <tool.Icon size={16} />
                </button>
              ))}
            </div>

            {/* Device type selector (only when device mode) */}
            {mode === 'device' && (
              <>
                <div className="drawing-tool-divider" />
                <div className="drawing-tool-group">
                  {(Object.keys(DEVICE_TYPE_LABELS) as SecurityDeviceType[]).map((t) => (
                    <button
                      key={t}
                      className={'drawing-tool-btn btn-sm' + (deviceType === t ? ' active' : '')}
                      onClick={() => onDeviceTypeChange(t)}
                      title={DEVICE_TYPE_LABELS[t]}
                      type="button"
                    >
                      {DEVICE_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="drawing-tool-divider" />

            {/* File actions */}
            <div className="drawing-tool-group">
              <button className="drawing-tool-btn btn-sm" onClick={onLoadSample} title="샘플 불러오기" type="button">
                샘플
              </button>
              <button className="drawing-tool-btn btn-sm" onClick={onClear} disabled={wallCount === 0} title="전체 지우기" type="button">
                지우기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
