import type { EditMode } from '../stores/editorStore'
import { useEditorStore } from '../stores/editorStore'

type Props = {
  mode: EditMode
  onChange: (mode: EditMode) => void
  onLoadSample: () => void
  onClear: () => void
  wallCount: number
}

const TOOLS: { id: EditMode; label: string; icon: string }[] = [
  { id: 'select', label: '선택', icon: '⬚' },
  { id: 'wall', label: '벽 그리기', icon: '╱' },
  { id: 'delete', label: '삭제', icon: '✕' },
]

export function DrawingToolbar({ mode, onChange, onLoadSample, onClear, wallCount }: Props) {
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
