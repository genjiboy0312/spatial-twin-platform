type ViewMode = '2d' | 'split' | '3d' | 'pointcloud' | 'ifc'

interface Props {
  viewMode: ViewMode
  viewModes: ViewMode[]
  labels: Record<string, string>
  onViewModeChange: (mode: ViewMode) => void
}

export function ViewModeBar({ viewMode, viewModes, labels, onViewModeChange }: Props) {
  return (
    <div className="view-mode-bar">
      {viewModes.map((nextMode) => (
        <button
          key={nextMode}
          className={`view-mode-bar-btn${viewMode === nextMode ? ' active' : ''}`}
          type="button"
          onClick={() => onViewModeChange(nextMode)}
        >
          {labels[nextMode]}
        </button>
      ))}
    </div>
  )
}
