import type { EditMode } from '../stores/editorStore'

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
        <button className="btn btn-secondary" onClick={onLoadSample}>
          샘플 불러오기
        </button>
        <button className="btn btn-secondary" onClick={onClear} disabled={wallCount === 0}>
          전체 지우기
        </button>
      </div>
    </div>
  )
}
