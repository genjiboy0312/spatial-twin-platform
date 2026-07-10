export interface MonitorStatsPanelProps {
  deviceCount: number
  eventCount: number
  alertCount: number
  selectedBuildingName: string | null
  selectedFloorName: string | null
}

export function MonitorStatsPanel({
  deviceCount,
  eventCount,
  alertCount,
  selectedBuildingName,
  selectedFloorName,
}: MonitorStatsPanelProps) {
  return (
    <div className="monitor-stats-panel">
      <span>System Stats</span>
      <div>
        <small>Devices</small>
        <strong>{deviceCount}</strong>
      </div>
      <div>
        <small>Events</small>
        <strong>{eventCount}</strong>
      </div>
      <div>
        <small>Alarms</small>
        <strong>{alertCount}</strong>
      </div>
      {(selectedBuildingName !== null || selectedFloorName !== null) && (
        <div>
          <small>{selectedBuildingName ?? 'Selected Location'}</small>
          <strong>{selectedFloorName ?? '-'}</strong>
        </div>
      )}
    </div>
  )
}
