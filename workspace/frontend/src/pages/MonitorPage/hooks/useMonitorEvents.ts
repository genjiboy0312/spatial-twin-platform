import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RealtimeEvent } from '../monitorTypes'
const FALLBACK_EVENTS: RealtimeEvent[] = [
  { id: 'evt-init', severity: 'info', source: 'system', message: 'Monitoring console initialized.', timestamp: new Date().toISOString() },
  { id: 'evt-camera', severity: 'warning', source: 'camera', message: 'Camera coverage should be reviewed.', timestamp: new Date(Date.now() - 42000).toISOString() },
]

export interface MonitorEventsState {
  events: RealtimeEvent[]
  summary: { critical: number; warning: number; info: number }
  connectionState: 'live' | 'demo'
  refresh: () => void
}

export function useMonitorEvents(language: string): MonitorEventsState {
  const [events, setEvents] = useState<RealtimeEvent[]>(FALLBACK_EVENTS)
  const [connectionState, setConnectionState] = useState<'live' | 'demo'>('demo')

  // Synthetic event generator
  useEffect(() => {
    const timer = window.setInterval(() => {
      const index = Math.floor(Date.now() / 5000) % 4
      const templates: RealtimeEvent[] = [
        { id: crypto.randomUUID(), severity: 'info', source: 'device', message: language === 'ko' ? '장치 상태 동기화 완료' : 'Device status synchronized', timestamp: new Date().toISOString() },
        { id: crypto.randomUUID(), severity: 'warning', source: 'gps', message: language === 'ko' ? 'GPS 기준점 편차 감지' : 'GPS anchor drift detected', timestamp: new Date().toISOString() },
        { id: crypto.randomUUID(), severity: 'info', source: 'pointcloud', message: language === 'ko' ? 'PointCloud 레이어 준비됨' : 'PointCloud layer ready', timestamp: new Date().toISOString() },
        { id: crypto.randomUUID(), severity: 'critical', source: 'alarm', message: language === 'ko' ? '동측 구역 알람 이벤트' : 'Alarm event in east zone', timestamp: new Date().toISOString() },
      ]
      setEvents((current) => [templates[index]!, ...current].slice(0, 18))
    }, 8000)
    return () => window.clearInterval(timer)
  }, [language])

  // WebSocket connection attempt
  useEffect(() => {
    const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://localhost:3000/ws`
    let socket: WebSocket | null = null
    try {
      socket = new WebSocket(url)
      socket.onopen = () => setConnectionState('live')
      socket.onmessage = (message) => {
        try {
          const payload = JSON.parse(message.data) as Partial<RealtimeEvent>
          setEvents((current) => [
            {
              id: payload.id ?? crypto.randomUUID(),
              severity: (payload.severity ?? 'info') as 'info' | 'warning' | 'critical',
              source: payload.source ?? 'websocket',
              message: payload.message ?? 'Realtime event received',
              timestamp: payload.timestamp ?? new Date().toISOString(),
            },
            ...current,
          ].slice(0, 18))
        } catch { /* ignore malformed messages */ }
      }
      socket.onerror = () => setConnectionState('demo')
      socket.onclose = () => setConnectionState((c) => c === 'live' ? 'demo' : c)
    } catch {
      setConnectionState('demo')
    }
    return () => socket?.close()
  }, [])

  const refresh = useCallback(() => {
  setEvents((current: RealtimeEvent[]): RealtimeEvent[] => [{
      id: crypto.randomUUID(),
      severity: 'info' as const,
      source: 'operator',
      message: language === 'ko' ? '운영자가 모니터 상태를 새로고침했습니다.' : 'Operator refreshed monitor state.',
      timestamp: new Date().toISOString(),
    }, ...current].slice(0, 18))
  }, [language])

  const summary = useMemo(() => ({
    critical: events.filter((e) => e.severity === 'critical').length,
    warning: events.filter((e) => e.severity === 'warning').length,
    info: events.filter((e) => e.severity === 'info').length,
  }), [events])

  return { events, summary, connectionState, refresh }
}
