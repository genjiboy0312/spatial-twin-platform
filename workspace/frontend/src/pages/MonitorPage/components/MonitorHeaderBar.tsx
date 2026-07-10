import { LayoutPanelLeft, RefreshCw } from '../monitorIcons'

export type ConnectionState = 'live' | 'demo'

export interface MonitorHeaderBarProps {
  breadcrumb: string
  title: string
  subtitle: string
  showPointCloud: boolean
  onTogglePointCloud: (v: boolean) => void
  pointCloudCount: number
  showGps: boolean
  onToggleGps: (v: boolean) => void
  gpsCount: number
  showCoverage: boolean
  onToggleCoverage: (v: boolean) => void
  connectionState: ConnectionState
  onResetLayout: () => void
  onRefresh: () => void
}

function TogglePill({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  count?: number
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={checked ? 'active' : ''}
    >
      {label}
      {count !== undefined && <small>{count}</small>}
    </button>
  )
}

export function MonitorHeaderBar({
  breadcrumb,
  title,
  subtitle,
  showPointCloud,
  onTogglePointCloud,
  pointCloudCount,
  showGps,
  onToggleGps,
  gpsCount,
  showCoverage,
  onToggleCoverage,
  connectionState,
  onResetLayout,
  onRefresh,
}: MonitorHeaderBarProps) {
  return (
    <header className="monitor-header-bar">
      <div>
        <nav aria-label="breadcrumb">
          <span>{breadcrumb}</span>
        </nav>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="monitor-header-actions">
        <TogglePill
          checked={showPointCloud}
          onChange={onTogglePointCloud}
          label="Point Cloud"
          count={pointCloudCount}
        />
        <TogglePill
          checked={showGps}
          onChange={onToggleGps}
          label="GPS Billboard"
          count={gpsCount}
        />
        <TogglePill
          checked={showCoverage}
          onChange={onToggleCoverage}
          label="Wide Rendering"
        />

        <div className={`monitor-connection ${connectionState === 'live' ? 'live' : ''}`}>
          <i />
          <span>
            {connectionState === 'live' ? 'Live' : 'Demo mode'}
          </span>
        </div>

        <button
          type="button"
          onClick={onResetLayout}
        >
          <LayoutPanelLeft size={13} />
          Reset layout
        </button>
        <button
          type="button"
          onClick={onRefresh}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>
    </header>
  )
}
