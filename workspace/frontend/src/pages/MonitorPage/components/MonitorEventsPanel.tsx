import { useMemo, useState } from 'react'

import type { RealtimeEvent } from '../monitorTypes'
import { AlertCircle, AlertTriangle, Info } from '../monitorIcons'

export interface MonitorEventsPanelProps {
  events: RealtimeEvent[]
  labels: { severity: Record<string, string>; eventFeed: string }
  noEvents: string
  formatTime: (value: string) => string
}

type EventSeverity = RealtimeEvent['severity'] | 'all'

const SEVERITIES: EventSeverity[] = ['all', 'critical', 'warning', 'info']

function eventIcon(severity: RealtimeEvent['severity']) {
  if (severity === 'critical') return AlertCircle
  if (severity === 'warning') return AlertTriangle
  return Info
}

export function MonitorEventsPanel({ events, labels, noEvents, formatTime }: MonitorEventsPanelProps) {
  const [activeSeverity, setActiveSeverity] = useState<EventSeverity>('all')

  const sortedEvents = useMemo(
    () => [...events]
      .filter((event) => activeSeverity === 'all' || event.severity === activeSeverity)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [activeSeverity, events],
  )

  const severityCounts = useMemo(() => {
    const counts: Record<EventSeverity, number> = { all: events.length, critical: 0, warning: 0, info: 0 }
    for (const event of events) counts[event.severity] += 1
    return counts
  }, [events])

  return (
    <>
      <div className="monitor-tabbar">
        {SEVERITIES.map((severity) => (
          <button
            key={severity}
            type="button"
            className={activeSeverity === severity ? 'active' : ''}
            onClick={() => setActiveSeverity(severity)}
          >
            {severity === 'all' ? labels.eventFeed : labels.severity[severity]}
            <small>{severityCounts[severity]}</small>
          </button>
        ))}
      </div>

      <div className="monitor-events-panel">
        {sortedEvents.length === 0 ? (
          <div className="monitor-panel-empty">{noEvents}</div>
        ) : (
          sortedEvents.map((event) => {
            const Icon = eventIcon(event.severity)
            return (
              <article key={event.id} className={`monitor-event-row ${event.severity}`}>
                <span>
                  <Icon size={15} />
                </span>
                <div>
                  <strong>{labels.severity[event.severity] ?? event.severity} / {event.source}</strong>
                  <p>{event.message}</p>
                </div>
                <small>{formatTime(event.timestamp)}</small>
              </article>
            )
          })
        )}
      </div>
    </>
  )
}
