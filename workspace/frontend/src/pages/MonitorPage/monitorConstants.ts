// Monitor page constants — ported from reference project
import type { LogLevel } from './monitorTypes'

export const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
  debug: 'debug',
}

export const MAX_SYSTEM_LOGS = 400
export const SYNTHETIC_MONITOR_INTERVAL_MS = 30 * 1000
