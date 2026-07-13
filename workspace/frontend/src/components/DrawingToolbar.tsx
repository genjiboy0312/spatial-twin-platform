import { useState } from 'react'

import { DEVICE_TYPE_LABELS } from '../constants/devices'
import type { EditMode, SecurityDeviceType } from '../stores/editorStore'
import {
  AppWindow,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  DoorOpen,
  Eye,
  EyeOff,
  MousePointer2,
  Pencil,
  Square,
  SquareDashed,
  Trash2,
} from './Icons'

type Props = {
  mode: EditMode
  language?: 'en' | 'ko'
  onChange: (mode: EditMode) => void
  onLoadSample: () => void
  onClear: () => void
  wallCount: number
  deviceType: SecurityDeviceType
  onDeviceTypeChange: (t: SecurityDeviceType) => void
  showEndpoints: boolean
  onToggleEndpoints: () => void
}

type ToolDef = {
  id: EditMode
  label: { en: string; ko: string }
  Icon: React.ComponentType<{ size?: number; className?: string }>
  shortcut: string
}

const DRAW_TOOLS: ToolDef[] = [
  { id: 'select', label: { en: 'Select', ko: '선택' }, Icon: MousePointer2, shortcut: 'S' },
  { id: 'wall', label: { en: 'Wall', ko: '벽' }, Icon: Pencil, shortcut: 'W' },
  { id: 'room', label: { en: 'Room', ko: '방' }, Icon: Square, shortcut: 'R' },
  { id: 'door', label: { en: 'Door', ko: '문' }, Icon: DoorOpen, shortcut: 'D' },
  { id: 'window', label: { en: 'Window', ko: '창문' }, Icon: AppWindow, shortcut: 'O' },
  { id: 'opening', label: { en: 'Opening', ko: '개구부' }, Icon: SquareDashed, shortcut: 'P' },
]

const TOOLS_META: ToolDef[] = [
  { id: 'delete', label: { en: 'Delete', ko: '삭제' }, Icon: Trash2, shortcut: 'X' },
  { id: 'device', label: { en: 'Device', ko: '장치' }, Icon: Crosshair, shortcut: 'V' },
]

const labels = {
  en: {
    open: 'Open toolbox',
    close: 'Close toolbox',
    hideEndpoints: 'Hide endpoints',
    showEndpoints: 'Show endpoints',
    sample: 'Sample',
    loadSample: 'Load sample',
    delete: 'Delete',
    deleteSelected: 'Delete selected object',
  },
  ko: {
    open: '도구상자 열기',
    close: '도구상자 닫기',
    hideEndpoints: '끝점 숨기기',
    showEndpoints: '끝점 보이기',
    sample: '샘플',
    loadSample: '샘플 불러오기',
    delete: '삭제',
    deleteSelected: '선택 객체 삭제',
  },
} as const

function ToolButton({ tool, active, language, onClick }: { tool: ToolDef; active: boolean; language: 'en' | 'ko'; onClick: () => void }) {
  return (
    <button
      className={'drawing-tool-btn' + (active ? ' active' : '')}
      onClick={onClick}
      title={`${tool.label[language]} (${tool.shortcut})`}
      type="button"
    >
      <tool.Icon size={16} />
    </button>
  )
}

export function DrawingToolbar({
  mode,
  language = 'en',
  onChange,
  onLoadSample,
  onClear,
  deviceType,
  onDeviceTypeChange,
  showEndpoints,
  onToggleEndpoints,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const t = labels[language]

  return (
    <div className="drawing-floating-panel">
      <button
        className="drawing-floating-toggle"
        onClick={() => setCollapsed((value) => !value)}
        title={collapsed ? t.open : t.close}
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
            <div className="drawing-tool-row">
              <div className="drawing-tool-group">
                {DRAW_TOOLS.slice(0, 3).map((tool) => (
                  <ToolButton key={tool.id} tool={tool} active={mode === tool.id} language={language} onClick={() => onChange(tool.id)} />
                ))}
              </div>
              <div className="drawing-tool-divider" />
              <div className="drawing-tool-group">
                {DRAW_TOOLS.slice(3).map((tool) => (
                  <ToolButton key={tool.id} tool={tool} active={mode === tool.id} language={language} onClick={() => onChange(tool.id)} />
                ))}
              </div>
            </div>

            <div className="drawing-tool-row">
              <div className="drawing-tool-group">
                {TOOLS_META.map((tool) => (
                  <ToolButton key={tool.id} tool={tool} active={mode === tool.id} language={language} onClick={() => onChange(tool.id)} />
                ))}
              </div>

              {mode === 'device' && (
                <div className="drawing-tool-group">
                  {(Object.keys(DEVICE_TYPE_LABELS) as SecurityDeviceType[]).map((type) => (
                    <button
                      key={type}
                      className={'drawing-tool-btn btn-sm' + (deviceType === type ? ' active' : '')}
                      onClick={() => onDeviceTypeChange(type)}
                      title={DEVICE_TYPE_LABELS[type]}
                      type="button"
                    >
                      {DEVICE_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              )}

              <div className="drawing-tool-divider" />

              <div className="drawing-tool-group">
                <button
                  className={'drawing-tool-btn' + (showEndpoints ? ' active' : '')}
                  onClick={onToggleEndpoints}
                  title={showEndpoints ? t.hideEndpoints : t.showEndpoints}
                  type="button"
                >
                  {showEndpoints ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button className="drawing-tool-btn btn-sm" onClick={onLoadSample} title={t.loadSample} type="button">
                  {t.sample}
                </button>
                <button className="drawing-tool-btn btn-sm" onClick={onClear} title={t.deleteSelected} type="button">
                  {t.delete}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
