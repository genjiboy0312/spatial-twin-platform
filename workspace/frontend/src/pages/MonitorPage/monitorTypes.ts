// Monitor page shared type definitions — ported from reference project
import type { SecurityDeviceType } from '../../stores/editorStore'

export type LogLevel = 'info' | 'warning' | 'error' | 'debug'

export type SystemLog = {
  id: number
  level: LogLevel
  source?: string
  message: string
  timestamp: string
}

export type BottomPanelTab = 'logs' | 'cameras'

export type MonitorIconName =
  | 'building'
  | 'floor'
  | 'camera'
  | 'sensor'
  | 'alarm'
  | 'access'
  | 'event'
  | 'log'
  | 'refresh'
  | 'layout'
  | 'cloud'
  | 'gps'
  | 'coverage'
  | 'check'
  | 'warning'
  | 'critical'
  | 'editor'

export type { SecurityDeviceType }

export type RealtimeEvent = {
  id: string
  severity: 'info' | 'warning' | 'critical'
  source: string
  message: string
  timestamp: string
}
