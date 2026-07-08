import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { listBuildings, type Building } from '../api/buildings'
import { listFloors, type Floor } from '../api/floors'
import { usePreferences } from '../app/preferences'
import { useEditorStore, type SecurityDevice, type SecurityDeviceType } from '../stores/editorStore'

type RealtimeEvent = {
  id: string
  severity: 'info' | 'warning' | 'critical'
  source: string
  message: string
  timestamp: string
}

type LogLevel = 'debug' | 'info' | 'warning' | 'error'
type SystemLog = {
  id: string
  level: LogLevel
  source: string
  message: string
  timestamp: string
}
type MonitorIconName =
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

const copy = {
  en: {
    breadcrumb: 'SOC / Monitor',
    title: 'Realtime Monitor',
    subtitle: 'Operational twin console with device status, spatial view, realtime events, and system logs.',
    complete: 'Operations handoff is ready.',
    validation: 'Back to Validation',
    pointCloud: 'Point Cloud',
    gps: 'GPS Billboard',
    cameraCoverage: 'Wide Rendering',
    disconnected: 'Demo mode',
    connected: 'Live',
    updated: 'Updated just now',
    resetLayout: 'Reset layout',
    refresh: 'Refresh',
    buildingFloors: 'Buildings / Floors',
    devices: 'Security Devices',
    map: 'Spatial View',
    events: 'Events',
    stats: 'Stats',
    logs: 'System Logs',
    cameras: 'Cameras',
    all: 'All',
    search: 'Search devices',
    selectFloor: 'Select a floor to inspect devices.',
    emptyDevices: 'No devices placed on this floor.',
    noMatch: 'No matching devices.',
    noBuildings: 'No projects yet. Create a project before monitoring.',
    openProjects: 'Open Projects',
    noEvents: 'No realtime events yet.',
    noCameras: 'No camera devices placed.',
    eventFeed: 'Realtime Event Feed',
    systemStats: 'System Stats',
    deviceCount: 'Devices',
    eventCount: 'Events',
    alertCount: 'Alarms',
    online: 'online',
    offline: 'offline',
    coverage: 'Coverage',
    selected: 'Selected',
    floors: 'floors',
    deviceLabels: {
      camera: 'Camera',
      sensor: 'Sensor',
      alarm: 'Alarm',
      access: 'Access',
    },
    severity: {
      info: 'Info',
      warning: 'Warning',
      critical: 'Critical',
    },
    logLevel: {
      debug: 'Debug',
      info: 'Info',
      warning: 'Warning',
      error: 'Error',
    },
  },
  ko: {
    breadcrumb: 'SOC / 모니터',
    title: '실시간 모니터',
    subtitle: '장치 상태, 공간 뷰, 실시간 이벤트, 시스템 로그를 한 화면에서 보는 운영 콘솔입니다.',
    complete: '운영 인계 준비가 완료되었습니다.',
    validation: '검증으로 돌아가기',
    pointCloud: 'Point Cloud',
    gps: 'GPS Billboard',
    cameraCoverage: '와이드 렌더링',
    disconnected: '데모 모드',
    connected: 'Live',
    updated: '방금 업데이트',
    resetLayout: '레이아웃 초기화',
    refresh: '새로고침',
    buildingFloors: '건물 / 층',
    devices: '보안 장치',
    map: '공간 뷰',
    events: '이벤트',
    stats: '통계',
    logs: '시스템 로그',
    cameras: '카메라',
    all: '전체',
    search: '장치 검색',
    selectFloor: '장치를 확인할 층을 선택하세요.',
    emptyDevices: '이 층에 배치된 장치가 없습니다.',
    noMatch: '검색 조건에 맞는 장치가 없습니다.',
    noBuildings: '아직 프로젝트가 없습니다. 모니터링 전에 프로젝트를 생성하세요.',
    openProjects: '프로젝트 열기',
    noEvents: '아직 실시간 이벤트가 없습니다.',
    noCameras: '배치된 카메라 장치가 없습니다.',
    eventFeed: '실시간 이벤트 피드',
    systemStats: '시스템 통계',
    deviceCount: '장치',
    eventCount: '이벤트',
    alertCount: '알람',
    online: '온라인',
    offline: '오프라인',
    coverage: '커버리지',
    selected: '선택됨',
    floors: '개 층',
    deviceLabels: {
      camera: '카메라',
      sensor: '센서',
      alarm: '알람',
      access: '출입',
    },
    severity: {
      info: '정보',
      warning: '주의',
      critical: '긴급',
    },
    logLevel: {
      debug: '디버그',
      info: '정보',
      warning: '주의',
      error: '오류',
    },
  },
} as const

const fallbackDevices: SecurityDevice[] = [
  { id: 'demo-camera-1', x: 4.5, y: 3.2, device_type: 'camera', name: 'CAM-Lobby-01' },
  { id: 'demo-camera-2', x: 12.4, y: 3.4, device_type: 'camera', name: 'CAM-Office-02' },
  { id: 'demo-sensor-1', x: 6.8, y: 9.8, device_type: 'sensor', name: 'Sensor-Temp-01' },
  { id: 'demo-alarm-1', x: 13.6, y: 10.5, device_type: 'alarm', name: 'Alarm-East-01' },
  { id: 'demo-access-1', x: 1.2, y: 6.6, device_type: 'access', name: 'Access-Main-01' },
]

function MonitorIcon({ name }: { name: MonitorIconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
  } as const

  const icons = {
    building: <path {...common} d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 8h.01M12 8h.01M15 8h.01M9 12h.01M12 12h.01M15 12h.01M8 21v-5h8v5" />,
    floor: <path {...common} d="m12 3 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4" />,
    camera: <path {...common} d="M4 7h11v10H4zM15 10l5-3v10l-5-3z" />,
    sensor: <path {...common} d="M12 18h.01M8.5 14.5a5 5 0 0 1 7 0M5 11a10 10 0 0 1 14 0" />,
    alarm: <path {...common} d="M6 8a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9M10 21h4" />,
    access: <path {...common} d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6zM12 15v2" />,
    event: <path {...common} d="M4 5h16M4 12h16M4 19h16M8 5v14" />,
    log: <path {...common} d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />,
    refresh: <path {...common} d="M20 12a8 8 0 1 1-2.3-5.7M20 4v6h-6" />,
    layout: <path {...common} d="M4 5h16v14H4zM9 5v14M9 10h11" />,
    cloud: <path {...common} d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.2 1.8A3.2 3.2 0 0 0 7 18Z" />,
    gps: <path {...common} d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11ZM12 10h.01" />,
    coverage: <path {...common} d="M4 18a8 8 0 0 1 16 0M8 18a4 4 0 0 1 8 0M12 18h.01" />,
    check: <path {...common} d="m5 12 4 4L19 6" />,
    warning: <path {...common} d="m12 3 9 16H3zM12 8v5M12 17h.01" />,
    critical: <path {...common} d="M12 3v10M12 17h.01M4 21h16" />,
    editor: <path {...common} d="M5 19h4l10-10a2.1 2.1 0 0 0-3-3L6 16zM13.5 6.5l4 4" />,
  } satisfies Record<MonitorIconName, ReactNode>

  return (
    <svg aria-hidden="true" className="monitor-icon-svg" viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  )
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--:--'
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function iconForDevice(type: SecurityDeviceType): MonitorIconName {
  if (type === 'camera') return 'camera'
  if (type === 'sensor') return 'sensor'
  if (type === 'alarm') return 'alarm'
  return 'access'
}

function eventIcon(severity: RealtimeEvent['severity']): MonitorIconName {
  if (severity === 'critical') return 'critical'
  if (severity === 'warning') return 'warning'
  return 'event'
}

export function MonitorPage() {
  const { language } = usePreferences()
  const labels = copy[language]
  const walls = useEditorStore((state) => state.walls)
  const rooms = useEditorStore((state) => state.rooms)
  const editorDevices = useEditorStore((state) => state.devices)
  const loadSample = useEditorStore((state) => state.loadSample)
  const devices = editorDevices.length > 0 ? editorDevices : fallbackDevices

  const [buildings, setBuildings] = useState<Building[]>([])
  const [floors, setFloors] = useState<Floor[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [showPointCloud, setShowPointCloud] = useState(true)
  const [showGps, setShowGps] = useState(false)
  const [showCoverage, setShowCoverage] = useState(true)
  const [rightTab, setRightTab] = useState<'devices' | 'events'>('devices')
  const [bottomTab, setBottomTab] = useState<'logs' | 'cameras'>('logs')
  const [bottomExpanded, setBottomExpanded] = useState(true)
  const [deviceFilter, setDeviceFilter] = useState<SecurityDeviceType | 'all'>('all')
  const [deviceSearch, setDeviceSearch] = useState('')
  const [connectionState, setConnectionState] = useState<'live' | 'demo'>('demo')

  useEffect(() => {
    if (walls.length === 0 && rooms.length === 0) loadSample()
  }, [loadSample, rooms.length, walls.length])

  const loadBuildings = useCallback(async () => {
    try {
      const data = await listBuildings()
      setBuildings(data)
      setSelectedBuildingId((current) => {
        if (current && data.some((building) => building.id === current)) return current
        return data[0]?.id ?? null
      })
    } catch {
      setBuildings([])
      setSelectedBuildingId(null)
    }
  }, [])

  useEffect(() => {
    loadBuildings()
  }, [loadBuildings])

  useEffect(() => {
    if (selectedBuildingId === null) {
      setFloors([])
      setSelectedFloorId(null)
      return
    }
    listFloors(selectedBuildingId)
      .then((nextFloors) => {
        setFloors(nextFloors)
        setSelectedFloorId((current) => {
          if (current && nextFloors.some((floor) => floor.id === current)) return current
          return nextFloors[0]?.id ?? null
        })
      })
      .catch(() => {
        setFloors([])
        setSelectedFloorId(null)
      })
  }, [selectedBuildingId])

  const [events, setEvents] = useState<RealtimeEvent[]>(() => [
    {
      id: 'evt-init',
      severity: 'info',
      source: 'system',
      message: language === 'ko' ? '모니터 콘솔이 초기화되었습니다.' : 'Monitoring console initialized.',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'evt-camera',
      severity: 'warning',
      source: 'camera',
      message: language === 'ko' ? '카메라 커버리지 검토가 필요합니다.' : 'Camera coverage should be reviewed.',
      timestamp: new Date(Date.now() - 42_000).toISOString(),
    },
  ])

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

  useEffect(() => {
    const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://localhost:3000/ws`
    let socket: WebSocket | null = null
    try {
      socket = new WebSocket(url)
      socket.onopen = () => setConnectionState('live')
      socket.onmessage = (message) => {
        const payload = JSON.parse(message.data) as Partial<RealtimeEvent>
        setEvents((current) => [
          {
            id: payload.id ?? crypto.randomUUID(),
            severity: payload.severity ?? 'info',
            source: payload.source ?? 'websocket',
            message: payload.message ?? 'Realtime event received',
            timestamp: payload.timestamp ?? new Date().toISOString(),
          },
          ...current,
        ].slice(0, 18))
      }
      socket.onerror = () => setConnectionState('demo')
      socket.onclose = () => setConnectionState((current) => (current === 'live' ? 'demo' : current))
    } catch {
      setConnectionState('demo')
    }
    return () => socket?.close()
  }, [])

  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId) ?? null
  const selectedFloor = floors.find((floor) => floor.id === selectedFloorId) ?? null
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? null
  const cameras = devices.filter((device) => device.device_type === 'camera')
  const filteredDevices = devices.filter((device) => {
    const matchesType = deviceFilter === 'all' || device.device_type === deviceFilter
    const matchesSearch = device.name.toLowerCase().includes(deviceSearch.toLowerCase()) || device.device_type.includes(deviceSearch.toLowerCase())
    return matchesType && matchesSearch
  })

  const summary = useMemo(
    () => ({
      critical: events.filter((event) => event.severity === 'critical').length,
      warning: events.filter((event) => event.severity === 'warning').length,
      info: events.filter((event) => event.severity === 'info').length,
    }),
    [events],
  )

  const logs: SystemLog[] = useMemo(
    () => events.slice(0, 12).map((event, index) => ({
      id: `log-${event.id}`,
      level: event.severity === 'critical' ? 'error' : event.severity === 'warning' ? 'warning' : index % 3 === 0 ? 'debug' : 'info',
      source: event.source,
      message: event.message,
      timestamp: event.timestamp,
    })),
    [events],
  )

  const refresh = () => {
    setEvents((current) => [{
      id: crypto.randomUUID(),
      severity: 'info' as const,
      source: 'operator',
      message: language === 'ko' ? '운영자가 모니터 상태를 새로고침했습니다.' : 'Operator refreshed monitor state.',
      timestamp: new Date().toISOString(),
    }, ...current].slice(0, 18))
  }

  const resetLayout = () => {
    setRightTab('devices')
    setBottomTab('logs')
    setBottomExpanded(true)
    setShowCoverage(true)
    setShowPointCloud(true)
    setShowGps(false)
  }

  return (
    <section className="monitor-page">
      <div className="monitor-complete-banner">
        <span><MonitorIcon name="check" /> {labels.complete}</span>
        <Link className="btn btn-secondary" to="/validation">{labels.validation}</Link>
      </div>

      <header className="monitor-header-bar">
        <div>
          <nav>{labels.breadcrumb}</nav>
          <h1>{labels.title}</h1>
          <p>{labels.subtitle}</p>
        </div>
        <div className="monitor-header-actions">
          <button className={showPointCloud ? 'active' : ''} type="button" onClick={() => setShowPointCloud((value) => !value)}>
            <MonitorIcon name="cloud" /> {labels.pointCloud} <small>1</small>
          </button>
          <button className={showGps ? 'active' : ''} type="button" onClick={() => setShowGps((value) => !value)}>
            <MonitorIcon name="gps" /> {labels.gps} <small>{showGps ? 3 : 0}</small>
          </button>
          <button className={showCoverage ? 'active' : ''} type="button" onClick={() => setShowCoverage((value) => !value)}>
            <MonitorIcon name="coverage" /> {labels.cameraCoverage}
          </button>
          <span className={`monitor-connection ${connectionState}`}>
            <i />
            {connectionState === 'live' ? labels.connected : labels.disconnected}
          </span>
          <small>{labels.updated}</small>
          <button type="button" onClick={resetLayout}><MonitorIcon name="layout" /> {labels.resetLayout}</button>
          <button type="button" onClick={refresh}><MonitorIcon name="refresh" /> {labels.refresh}</button>
        </div>
      </header>

      {buildings.length === 0 ? (
        <div className="monitor-empty-state">
          <MonitorIcon name="building" />
          <strong>{labels.noBuildings}</strong>
          <Link className="btn btn-primary" to="/projects">{labels.openProjects}</Link>
        </div>
      ) : (
        <div className="monitor-workspace">
          <aside className="monitor-panel monitor-tree-panel">
            <div className="monitor-panel-title">
              <span>{labels.buildingFloors}</span>
              <strong>{buildings.length}</strong>
            </div>
            <div className="monitor-building-list">
              {buildings.map((building) => (
                <button key={building.id} className={building.id === selectedBuildingId ? 'active' : ''} type="button" onClick={() => setSelectedBuildingId(building.id)}>
                  <span><MonitorIcon name="building" /> {building.name}</span>
                  <small>{building.total_floors} {labels.floors}</small>
                </button>
              ))}
            </div>
            <div className="monitor-panel-title compact">
              <span>{selectedBuilding?.name ?? labels.buildingFloors}</span>
              <strong>{floors.length}</strong>
            </div>
            <div className="monitor-floor-list">
              {floors.map((floor) => (
                <button key={floor.id} className={floor.id === selectedFloorId ? 'active' : ''} type="button" onClick={() => setSelectedFloorId(floor.id)}>
                  <MonitorIcon name="floor" />
                  <span>{floor.floor_name ?? `${floor.floor_number}F`}</span>
                  <small>#{floor.id}</small>
                </button>
              ))}
            </div>
            <StatsPanel labels={labels} devices={devices.length} events={events.length} alerts={summary.critical + summary.warning} />
          </aside>

          <main className="monitor-panel monitor-center-panel">
            <div className="monitor-panel-title overlay">
              <span>{labels.map}</span>
              <strong>{selectedFloor?.floor_name ?? selectedBuilding?.name ?? labels.map}</strong>
            </div>
            <MonitorSpatialView
              devices={devices}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={setSelectedDeviceId}
              showCoverage={showCoverage}
              showGps={showGps}
              showPointCloud={showPointCloud}
            />
          </main>

          <aside className="monitor-panel monitor-right-panel">
            <div className="monitor-tabbar">
              <button className={rightTab === 'devices' ? 'active' : ''} type="button" onClick={() => setRightTab('devices')}>
                <MonitorIcon name="check" /> {labels.devices} <small>{devices.length}</small>
              </button>
              <button className={rightTab === 'events' ? 'active' : ''} type="button" onClick={() => setRightTab('events')}>
                <MonitorIcon name="event" /> {labels.events} <small>{events.length}</small>
              </button>
            </div>
            {rightTab === 'devices' ? (
              <DevicePanel
                labels={labels}
                devices={filteredDevices}
                selectedDeviceId={selectedDeviceId}
                deviceFilter={deviceFilter}
                search={deviceSearch}
                onFilter={setDeviceFilter}
                onSearch={setDeviceSearch}
                onSelect={setSelectedDeviceId}
              />
            ) : (
              <EventsPanel labels={labels} events={events} />
            )}
          </aside>
        </div>
      )}

      <section className={`monitor-bottom-panel ${bottomExpanded ? 'expanded' : ''}`}>
        <div className="monitor-bottom-header">
          <div>
            <button className={bottomTab === 'logs' ? 'active' : ''} type="button" onClick={() => { setBottomTab('logs'); setBottomExpanded(true) }}>
              <MonitorIcon name="log" /> {labels.logs} <small>{logs.length}</small>
            </button>
            <button className={bottomTab === 'cameras' ? 'active' : ''} type="button" onClick={() => { setBottomTab('cameras'); setBottomExpanded(true) }}>
              <MonitorIcon name="camera" /> {labels.cameras} <small>{cameras.length}</small>
            </button>
          </div>
          <button type="button" onClick={() => setBottomExpanded((value) => !value)}>{bottomExpanded ? 'Collapse' : 'Expand'}</button>
        </div>
        {bottomExpanded && (
          <div className="monitor-bottom-body">
            {bottomTab === 'logs' ? <LogsPanel labels={labels} logs={logs} /> : <CameraCards labels={labels} cameras={cameras} selectedDeviceId={selectedDeviceId} onSelect={setSelectedDeviceId} />}
          </div>
        )}
      </section>

      {selectedDevice && (
        <div className="monitor-selection-toast">
          <MonitorIcon name={iconForDevice(selectedDevice.device_type)} />
          <span>{labels.selected}: {selectedDevice.name}</span>
        </div>
      )}
    </section>
  )
}

function StatsPanel({ labels, devices, events, alerts }: { labels: typeof copy.en | typeof copy.ko; devices: number; events: number; alerts: number }) {
  return (
    <div className="monitor-stats-panel">
      <span>{labels.systemStats}</span>
      <div><small>{labels.deviceCount}</small><strong>{devices}</strong></div>
      <div><small>{labels.eventCount}</small><strong>{events}</strong></div>
      <div><small>{labels.alertCount}</small><strong>{alerts}</strong></div>
    </div>
  )
}

function MonitorSpatialView({
  devices,
  selectedDeviceId,
  onSelectDevice,
  showCoverage,
  showGps,
  showPointCloud,
}: {
  devices: SecurityDevice[]
  selectedDeviceId: string | null
  onSelectDevice: (id: string) => void
  showCoverage: boolean
  showGps: boolean
  showPointCloud: boolean
}) {
  const toX = (x: number) => 40 + x * 42
  const toY = (y: number) => 42 + y * 30
  return (
    <svg className="monitor-spatial-view" viewBox="0 0 780 520" role="img" aria-label="Monitor spatial view">
      <defs>
        <pattern id="monitor-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="780" height="520" fill="url(#monitor-grid)" />
      {showPointCloud && Array.from({ length: 120 }, (_, index) => (
        <circle
          key={index}
          cx={110 + ((index * 47) % 560)}
          cy={90 + ((index * 31) % 340)}
          r={1.2 + (index % 4) * 0.4}
          fill="#93c5fd"
          opacity={0.18 + (index % 6) * 0.08}
        />
      ))}
      <rect x="72" y="72" width="600" height="360" rx="10" fill="rgba(24,24,27,0.38)" stroke="rgba(212,212,216,0.28)" />
      <path d="M72 220h250M322 72v180M322 252h350M500 252v180M72 340h235" stroke="#a1a1aa" strokeWidth="5" strokeLinecap="round" />
      <text x="105" y="125" fill="#a1a1aa" fontSize="13">Lobby</text>
      <text x="365" y="125" fill="#a1a1aa" fontSize="13">Office</text>
      <text x="530" y="310" fill="#a1a1aa" fontSize="13">Server</text>
      {showGps && ([
        [96, 82],
        [662, 88],
        [660, 422],
      ] satisfies Array<[number, number]>).map(([x, y], index) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="8" fill="#22c55e" />
          <text x={x + 12} y={y - 10} fill="#86efac" fontSize="11">GPS-{index + 1}</text>
        </g>
      ))}
      {devices.map((device) => {
        const x = toX(device.x)
        const y = toY(device.y)
        const selected = device.id === selectedDeviceId
        return (
          <g key={device.id} onClick={() => onSelectDevice(device.id)} className="monitor-device-node">
            {showCoverage && device.device_type === 'camera' && <circle cx={x} cy={y} r="80" fill="rgba(56,189,248,0.12)" stroke="rgba(56,189,248,0.18)" />}
            <circle cx={x} cy={y} r={selected ? 13 : 10} fill={device.device_type === 'alarm' ? '#ef4444' : device.device_type === 'sensor' ? '#38bdf8' : device.device_type === 'access' ? '#facc15' : '#22c55e'} stroke="#f4f4f5" strokeWidth="1.5" />
            <text x={x + 14} y={y - 12} fill={selected ? '#fafafa' : '#a1a1aa'} fontSize="11">{device.name}</text>
          </g>
        )
      })}
    </svg>
  )
}

function DevicePanel({
  labels,
  devices,
  selectedDeviceId,
  deviceFilter,
  search,
  onFilter,
  onSearch,
  onSelect,
}: {
  labels: typeof copy.en | typeof copy.ko
  devices: SecurityDevice[]
  selectedDeviceId: string | null
  deviceFilter: SecurityDeviceType | 'all'
  search: string
  onFilter: (filter: SecurityDeviceType | 'all') => void
  onSearch: (value: string) => void
  onSelect: (id: string) => void
}) {
  return (
    <div className="monitor-device-panel">
      <div className="monitor-device-search">
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={labels.search} />
      </div>
      <div className="monitor-device-filters">
        {(['all', 'camera', 'sensor', 'alarm', 'access'] as const).map((filter) => (
          <button key={filter} className={deviceFilter === filter ? 'active' : ''} type="button" onClick={() => onFilter(filter)}>
            {filter === 'all' ? labels.all : labels.deviceLabels[filter]}
          </button>
        ))}
      </div>
      {devices.length === 0 ? (
        <div className="monitor-panel-empty">{search ? labels.noMatch : labels.emptyDevices}</div>
      ) : (
        <div className="monitor-device-list">
          {devices.map((device) => (
            <button key={device.id} className={selectedDeviceId === device.id ? 'selected' : ''} type="button" onClick={() => onSelect(device.id)}>
              <span className="monitor-device-icon"><MonitorIcon name={iconForDevice(device.device_type)} /></span>
              <span>
                <strong>{device.name}</strong>
                <small>{labels.deviceLabels[device.device_type]} / {device.x.toFixed(1)}, {device.y.toFixed(1)}</small>
              </span>
              <i>{labels.online}</i>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EventsPanel({ labels, events }: { labels: typeof copy.en | typeof copy.ko; events: RealtimeEvent[] }) {
  return (
    <div className="monitor-events-panel">
      <div className="monitor-panel-title compact">
        <span>{labels.eventFeed}</span>
        <strong>{events.length}</strong>
      </div>
      {events.length === 0 ? (
        <div className="monitor-panel-empty">{labels.noEvents}</div>
      ) : (
        events.map((event) => (
          <article key={event.id} className={`monitor-event-row ${event.severity}`}>
            <span><MonitorIcon name={eventIcon(event.severity)} /></span>
            <div>
              <strong>{labels.severity[event.severity]} / {event.source}</strong>
              <p>{event.message}</p>
            </div>
            <small>{formatTime(event.timestamp)}</small>
          </article>
        ))
      )}
    </div>
  )
}

function LogsPanel({ labels, logs }: { labels: typeof copy.en | typeof copy.ko; logs: SystemLog[] }) {
  return (
    <div className="monitor-log-list">
      {logs.map((log) => (
        <div key={log.id} className={`monitor-log-row ${log.level}`}>
          <time>{formatTime(log.timestamp)}</time>
          <span>{labels.logLevel[log.level]}</span>
          <em>[{log.source}]</em>
          <p>{log.message}</p>
        </div>
      ))}
    </div>
  )
}

function CameraCards({
  labels,
  cameras,
  selectedDeviceId,
  onSelect,
}: {
  labels: typeof copy.en | typeof copy.ko
  cameras: SecurityDevice[]
  selectedDeviceId: string | null
  onSelect: (id: string) => void
}) {
  if (cameras.length === 0) return <div className="monitor-panel-empty">{labels.noCameras}</div>
  return (
    <div className="monitor-camera-strip">
      {cameras.map((camera) => (
        <button key={camera.id} className={selectedDeviceId === camera.id ? 'selected' : ''} type="button" onClick={() => onSelect(camera.id)}>
          <div className="monitor-camera-preview">
            <MonitorIcon name="camera" />
            <span>LIVE</span>
          </div>
          <strong>{camera.name}</strong>
          <small>{labels.online}</small>
        </button>
      ))}
    </div>
  )
}
