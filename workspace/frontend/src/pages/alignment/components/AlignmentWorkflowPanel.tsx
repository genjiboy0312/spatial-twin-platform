import { type ReactNode } from 'react'

type Language = 'ko' | 'en'

const labels = {
  ko: {
    title: 'OSM 정합',
    pointCloudTitle: 'PointCloud 정합',
    undo: 'Undo',
    redo: 'Redo',
  },
  en: {
    title: 'OSM Alignment',
    pointCloudTitle: 'PointCloud Alignment',
    undo: 'Undo',
    redo: 'Redo',
  },
} as const

interface AlignmentWorkflowPanelProps {
  alignmentMethod: 'osm' | 'pointcloud'
  children: ReactNode
  language?: Language
  undoCount?: number
  redoCount?: number
  onUndo?: () => void
  onRedo?: () => void
}

export function AlignmentWorkflowPanel({
  alignmentMethod,
  children,
  language = 'ko',
  undoCount = 0,
  redoCount = 0,
  onUndo,
  onRedo,
}: AlignmentWorkflowPanelProps) {
  const t = labels[language]

  return (
    <aside className="alignment-workflow-shell">
      <header>
        <h3>{alignmentMethod === 'osm' ? t.title : t.pointCloudTitle}</h3>
      </header>
      <div className="alignment-history-actions">
        <button type="button" disabled={undoCount === 0} onClick={onUndo}>{t.undo} ({undoCount})</button>
        <button type="button" disabled={redoCount === 0} onClick={onRedo}>{t.redo} ({redoCount})</button>
      </div>
      {children}
    </aside>
  )
}
