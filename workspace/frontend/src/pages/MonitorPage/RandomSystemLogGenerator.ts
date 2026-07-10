// Synthetic system log generator — ported from reference project

export type MonitorLogLevel = 'info' | 'warning' | 'error' | 'debug'

export interface SyntheticSystemLog {
  level: MonitorLogLevel
  source?: string
  message: string
}

type GeneratorOptions = {
  intervalMs?: number
  onLog: (log: SyntheticSystemLog) => void
}

const SOURCES = [
  'monitor.gateway',
  'edge.device-manager',
  'stream.pipeline',
  'map.renderer',
  'policy.engine',
  'sync.worker',
]

const LOG_TEMPLATES: Record<MonitorLogLevel, string[]> = {
  info: [
    '장치 상태 스냅샷이 정상적으로 동기화되었습니다.',
    '모니터링 세션 하트비트가 수신되었습니다.',
    '최근 이벤트 배치가 대시보드에 반영되었습니다.',
  ],
  warning: [
    '카메라 지연 시간이 임계치에 근접했습니다.',
    '일부 센서의 응답 시간이 증가하고 있습니다.',
    '이벤트 큐 처리량이 평소보다 높습니다.',
  ],
  error: [
    '장치 상태 동기화 중 재시도 한도를 초과했습니다.',
    '이벤트 브로드캐스트 전송에 실패했습니다.',
    '정책 엔진 규칙 평가에서 오류가 발생했습니다.',
  ],
  debug: [
    '배치 파이프라인 체크포인트를 기록했습니다.',
    '렌더링 오버레이 갱신 루프를 재시작했습니다.',
    '이벤트 파서가 fallback 스키마로 처리되었습니다.',
  ],
}

const LEVELS: MonitorLogLevel[] = ['info', 'info', 'warning', 'warning', 'error', 'debug']

function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

export class RandomSystemLogGenerator {
  private readonly intervalMs: number
  private readonly onLog: (log: SyntheticSystemLog) => void
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(options: GeneratorOptions) {
    this.intervalMs = Math.max(800, options.intervalMs ?? 2200)
    this.onLog = options.onLog
  }

  start() {
    if (this.timer) return
    this.timer = setInterval(() => {
      const level = randomChoice(LEVELS)
      const source = randomChoice(SOURCES)
      const message = randomChoice(LOG_TEMPLATES[level])
      this.onLog({ level, source, message })
    }, this.intervalMs)
  }

  stop() {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }
}
