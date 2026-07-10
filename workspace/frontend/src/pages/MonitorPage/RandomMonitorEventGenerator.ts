// Synthetic real-time event generator — ported from reference project

export type GeneratorEvent = {
  id: string
  severity: 'info' | 'warning' | 'critical'
  source: string
  message: string
  timestamp: string
  priority?: 'critical' | 'high' | 'medium' | 'low'
  building_id?: number
  floor_id?: number
  building_name?: string
  floor_name?: string
}

type GeneratorOptions = {
  intervalMs?: number
  onEvent: (event: GeneratorEvent) => void
}

const PRIORITIES: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low']

const EVENT_TEMPLATES: Record<string, string[]> = {
  critical: [
    '출입 통제 장치 연결이 끊어졌습니다.',
    '화재 센서가 임계값을 초과했습니다.',
    '중요 구역 침입 경보가 감지되었습니다.',
  ],
  high: [
    '카메라 프레임 드롭이 지속적으로 발생합니다.',
    '네트워크 지연이 높아지고 있습니다.',
    '장치 배터리 잔량이 급격히 감소 중입니다.',
  ],
  medium: [
    '정기 점검이 예정된 장치가 있습니다.',
    '저장소 사용량이 기준치에 근접했습니다.',
    '보안 장치 상태 업데이트가 지연되었습니다.',
  ],
  low: [
    '주기 점검 로그가 기록되었습니다.',
    '일반 상태 이벤트가 수신되었습니다.',
    '모니터링 세션이 정상적으로 유지 중입니다.',
  ],
}

function priorityToSeverity(priority: string): GeneratorEvent['severity'] {
  switch (priority) {
    case 'critical':
    case 'high':
      return 'critical'
    case 'medium':
      return 'warning'
    default:
      return 'info'
  }
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

export class RandomMonitorEventGenerator {
  private readonly intervalMs: number
  private readonly onEvent: (event: GeneratorEvent) => void
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(options: GeneratorOptions) {
    this.intervalMs = Math.max(1000, options.intervalMs ?? 2500)
    this.onEvent = options.onEvent
  }

  start() {
    if (this.timer) return
    this.timer = setInterval(() => {
      const priority = randomChoice(PRIORITIES)
      const message = randomChoice(EVENT_TEMPLATES[priority] ?? [])
      const now = new Date().toISOString()
      const event: GeneratorEvent = {
        id: randomId(),
        severity: priorityToSeverity(priority),
        source: 'synthetic',
        message,
        timestamp: now,
        priority,
      }
      this.onEvent(event)
    }, this.intervalMs)
  }

  stop() {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }
}
