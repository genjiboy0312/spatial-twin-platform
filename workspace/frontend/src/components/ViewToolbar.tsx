import { Undo2, Redo2 } from './Icons'
import { useEditorStore } from '../stores/editorStore'

export function ViewToolbar() {
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const historyIdx = useEditorStore((s) => s.historyIdx)
  const historyLen = useEditorStore((s) => s.history.length)

  return (
    <div className="view-toolbar">
      <div className="view-toolbar-left">
        <button
          className="view-toolbar-btn"
          onClick={undo}
          disabled={historyIdx < 0}
          title="실행 취소 (Ctrl+Z)"
          type="button"
        >
          <Undo2 size={14} />
          <span>실행취소</span>
        </button>
        <div className="view-toolbar-divider" />
        <button
          className="view-toolbar-btn"
          onClick={redo}
          disabled={historyIdx + 2 >= historyLen}
          title="다시 실행 (Ctrl+Y)"
          type="button"
        >
          <Redo2 size={14} />
          <span>다시실행</span>
        </button>
      </div>
    </div>
  )
}
