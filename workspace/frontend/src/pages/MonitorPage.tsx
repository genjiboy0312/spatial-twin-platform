import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from './PageHeader'

type RealtimeEvent = {
  id: string
  severity: 'info' | 'warning' | 'critical'
  source: string
  message: string
  timestamp: string
}

const SEED_EVENTS: RealtimeEvent[] = [
  {
    id: 'evt-1',
    severity: 'info',
    source: 'system',
    message: 'Monitoring dashboard initialized',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'evt-2',
    severity: 'warning',
    source: 'camera',
    message: 'Camera coverage should be reviewed after layout edits',
    timestamp: new Date(Date.now() - 45_000).toISOString(),
  },
]

export function MonitorPage() {
  const [events, setEvents] = useState<RealtimeEvent[]>(SEED_EVENTS)
  const [connectionState, setConnectionState] = useState<'connecting' | 'live' | 'demo'>('connecting')

  useEffect(() => {
    const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://localhost:3000/ws`
    let socket: WebSocket | null = null
    const demoTimer = window.setTimeout(() => {
      setConnectionState((current) => (current === 'connecting' ? 'demo' : current))
    }, 900)

    try {
      socket = new WebSocket(url)
      socket.onopen = () => setConnectionState('live')
      socket.onmessage = (message) => {
        const payload = JSON.parse(message.data) as Partial<RealtimeEvent>
        setEvents((current) =>
          [
            {
              id: payload.id ?? crypto.randomUUID(),
              severity: payload.severity ?? 'info',
              source: payload.source ?? 'websocket',
              message: payload.message ?? 'Realtime event received',
              timestamp: payload.timestamp ?? new Date().toISOString(),
            },
            ...current,
          ].slice(0, 20),
        )
      }
      socket.onerror = () => setConnectionState('demo')
      socket.onclose = () => setConnectionState((current) => (current === 'live' ? 'demo' : current))
    } catch {
      setConnectionState('demo')
    }

    return () => {
      socket?.close()
      window.clearTimeout(demoTimer)
    }
  }, [])

  const summary = useMemo(
    () => ({
      critical: events.filter((event) => event.severity === 'critical').length,
      warning: events.filter((event) => event.severity === 'warning').length,
      info: events.filter((event) => event.severity === 'info').length,
    }),
    [events],
  )

  return (
    <section className="page-grid editor-layout" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <PageHeader
        eyebrow="Operations"
        title="Monitor"
        description="Track realtime events, device status, and operator alerts through WebSocket when available."
      />

      <div className="full-width card-list">
        <div className="card" style={{ borderRadius: 14 }}>
          <strong>{connectionState === 'live' ? 'Live' : connectionState === 'demo' ? 'Demo' : 'Connecting'}</strong>
          <p>WebSocket status</p>
        </div>
        <div className="card" style={{ borderRadius: 14 }}>
          <strong>{summary.critical}</strong>
          <p>Critical alerts</p>
        </div>
        <div className="card" style={{ borderRadius: 14 }}>
          <strong>{summary.warning}</strong>
          <p>Warnings</p>
        </div>
        <div className="card" style={{ borderRadius: 14 }}>
          <strong>{summary.info}</strong>
          <p>Info events</p>
        </div>
      </div>

      <div className="full-width card" style={{ borderRadius: 14 }}>
        <strong>Event Stream</strong>
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {events.map((event) => (
            <div
              key={event.id}
              style={{
                alignItems: 'center',
                background: '#0f172a',
                border: '1px solid rgba(148, 163, 184, 0.12)',
                borderRadius: 10,
                display: 'grid',
                gap: 12,
                gridTemplateColumns: '110px 130px minmax(0, 1fr) 180px',
                padding: '10px 12px',
              }}
            >
              <span
                style={{
                  color: event.severity === 'critical' ? '#f87171' : event.severity === 'warning' ? '#fbbf24' : '#60a5fa',
                  fontWeight: 700,
                }}
              >
                {event.severity}
              </span>
              <span style={{ color: '#cbd5e1' }}>{event.source}</span>
              <span>{event.message}</span>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{new Date(event.timestamp).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
