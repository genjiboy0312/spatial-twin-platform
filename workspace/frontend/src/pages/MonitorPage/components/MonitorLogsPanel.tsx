import type { SystemLog } from '../monitorTypes'

export interface MonitorLogsPanelProps {
  logs: SystemLog[]
  formatTime: (value: string) => string
  logLevelLabels: Record<string, string>
}

export function MonitorLogsPanel({ logs, formatTime, logLevelLabels }: MonitorLogsPanelProps) {
  if (logs.length === 0) {
    return <div className="monitor-panel-empty">No system logs yet.</div>
  }

  return (
    <div className="monitor-log-list">
      {logs.map((log) => (
        <div key={log.id} className={`monitor-log-row ${log.level}`}>
          <time>{formatTime(log.timestamp)}</time>
          <span>{logLevelLabels[log.level] ?? log.level}</span>
          <em>{log.source ? `[${log.source}]` : '-'}</em>
          <p>{log.message}</p>
        </div>
      ))}
    </div>
  )
}
