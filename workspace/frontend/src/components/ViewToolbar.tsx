import { Undo2, Redo2 } from './Icons'
import { useEditorStore } from '../stores/editorStore'

type EditorSaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

function saveLabel(status: EditorSaveStatus, language: 'en' | 'ko') {
  const labels = {
    en: {
      idle: 'Project sync ready',
      loading: 'Loading project state...',
      saving: 'Saving project state...',
      saved: 'Autosaved just now',
      error: 'Autosave failed',
    },
    ko: {
      idle: '프로젝트 동기화 준비',
      loading: '프로젝트 상태 불러오는 중...',
      saving: '프로젝트 상태 저장 중...',
      saved: '방금 자동 저장됨',
      error: '자동 저장 실패',
    },
  } as const
  return labels[language][status]
}

interface Props {
  saveStatus: EditorSaveStatus;
  language: 'en' | 'ko';
}

export function ViewToolbar({ saveStatus, language }: Props) {
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
      <div className="view-toolbar-right">
        <div className={`editor-autosave-pill ${saveStatus}`}>
          {saveLabel(saveStatus, language)}
        </div>
      </div>
    </div>
  )
}
