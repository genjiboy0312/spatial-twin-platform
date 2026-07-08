import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { listBuildings, type Building } from '../api/buildings'
import { usePreferences } from '../app/preferences'
import { useAlignmentStore } from '../stores/alignmentStore'
import { useEditorStore } from '../stores/editorStore'
import { PageHeader } from './PageHeader'

type DashboardIconName = 'building' | 'monitor' | 'alert' | 'activity' | 'clock' | 'device' | 'map' | 'arrow' | 'check'
type EventSeverity = 'critical' | 'high' | 'medium' | 'info'

const copy = {
  en: {
    eyebrow: 'Dashboard',
    title: 'Operations Dashboard',
    description: 'SOC-style overview for building inventory, model readiness, devices, alerts, and recent spatial twin activity.',
    newBuilding: 'New Building',
    openProjects: 'Open Projects',
    buildingHealth: 'Building Health',
    deviceStatus: 'Device Status',
    buildingCount: 'Buildings',
    activeAlarms: 'Active Alarms',
    point: 'pt',
    online: 'online',
    registered: 'registered',
    addBuilding: 'add building',
    normal: 'normal',
    checkRequired: 'check required',
    healthy: 'healthy',
    caution: 'caution',
    poor: 'poor',
    offline: 'offline',
    buildingList: 'Building List',
    recentEvents: 'Recent Events',
    noBuildings: 'No buildings registered yet. Create a project to start operating the twin.',
    loading: 'Loading buildings...',
    noEvents: 'No recent events.',
    floors: 'floors',
    devices: 'devices',
    geometry: 'geometry',
    alignment: 'alignment',
    openEditor: 'Open Editor',
    eventsCount: 'events',
    severity: {
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      info: 'Info',
    },
    events: {
      modelReady: 'Model registry synchronized with current editor geometry.',
      pointCloud: 'PointCloud staging branch is ready for scan uploads.',
      deviceReview: 'Device graph needs review before monitor deployment.',
      alignmentDone: 'GPS alignment is applied to the active spatial twin.',
      noAlignment: 'GPS alignment is waiting for anchor review.',
    },
  },
  ko: {
    eyebrow: '대시보드',
    title: '운영 대시보드',
    description: '건물 인벤토리, 모델 준비도, 장치, 알림, 최근 공간 트윈 활동을 한 화면에서 확인합니다.',
    newBuilding: '새 건물',
    openProjects: '프로젝트 열기',
    buildingHealth: '건물 상태',
    deviceStatus: '장치 상태',
    buildingCount: '건물 수',
    activeAlarms: '활성 알림',
    point: '점',
    online: '온라인',
    registered: '등록됨',
    addBuilding: '건물 추가',
    normal: '정상',
    checkRequired: '확인 필요',
    healthy: '양호',
    caution: '주의',
    poor: '위험',
    offline: '오프라인',
    buildingList: '건물 목록',
    recentEvents: '최근 이벤트',
    noBuildings: '아직 등록된 건물이 없습니다. 프로젝트를 생성하면 트윈 운영을 시작할 수 있습니다.',
    loading: '건물을 불러오는 중...',
    noEvents: '최근 이벤트가 없습니다.',
    floors: '층',
    devices: '장치',
    geometry: '지오메트리',
    alignment: '정합',
    openEditor: 'Editor 열기',
    eventsCount: '개 이벤트',
    severity: {
      critical: '긴급',
      high: '높음',
      medium: '중간',
      info: '정보',
    },
    events: {
      modelReady: '현재 편집 지오메트리와 모델 레지스트리가 동기화되었습니다.',
      pointCloud: 'PointCloud 스테이징 분기가 스캔 업로드를 받을 준비가 되었습니다.',
      deviceReview: '모니터 배포 전에 장치 그래프 검토가 필요합니다.',
      alignmentDone: '활성 공간 트윈에 GPS 정합이 적용되었습니다.',
      noAlignment: 'GPS 정합이 앵커 검토를 기다리고 있습니다.',
    },
  },
} as const

function DashboardIcon({ name }: { name: DashboardIconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
  } as const

  const icons = {
    building: <path {...common} d="M4 21V7l8-4 8 4v14M8 21v-7h8v7M8 8h.01M12 7h.01M16 8h.01M8 11h.01M12 11h.01M16 11h.01" />,
    monitor: <path {...common} d="M4 5h16v11H4zM9 21h6M12 16v5" />,
    alert: (
      <>
        <path {...common} d="m12 3 9 16H3z" />
        <path {...common} d="M12 8v5M12 17h.01" />
      </>
    ),
    activity: <path {...common} d="M4 12h4l2-6 4 12 2-6h4" />,
    clock: <path {...common} d="M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    device: <path {...common} d="M7 4h10v16H7zM10 17h4M10 7h4" />,
    map: <path {...common} d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2zM9 4v14M15 6v14" />,
    arrow: <path {...common} d="M5 12h14M13 6l6 6-6 6" />,
    check: <path {...common} d="m5 12 4 4L19 6" />,
  } satisfies Record<DashboardIconName, ReactNode>

  return (
    <svg aria-hidden="true" className="dashboard-icon-svg" viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  )
}

function formatRelativeTime(minutesAgo: number, language: 'en' | 'ko') {
  if (minutesAgo < 1) return language === 'ko' ? '방금 전' : 'just now'
  if (minutesAgo < 60) return language === 'ko' ? `${minutesAgo}분 전` : `${minutesAgo}m ago`
  const hours = Math.floor(minutesAgo / 60)
  return language === 'ko' ? `${hours}시간 전` : `${hours}h ago`
}

export function DashboardPage() {
  const { language } = usePreferences()
  const labels = copy[language]
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loadingBuildings, setLoadingBuildings] = useState(true)
  const walls = useEditorStore((state) => state.walls)
  const rooms = useEditorStore((state) => state.rooms)
  const devices = useEditorStore((state) => state.devices)
  const anchors = useAlignmentStore((state) => state.anchors)
  const isApplied = useAlignmentStore((state) => state.isApplied)

  const loadBuildings = useCallback(async () => {
    setLoadingBuildings(true)
    try {
      setBuildings(await listBuildings())
    } catch {
      setBuildings([])
    } finally {
      setLoadingBuildings(false)
    }
  }, [])

  useEffect(() => {
    loadBuildings()
  }, [loadBuildings])

  const totalDevices = devices.length
  const onlineDevices = Math.max(0, totalDevices - (totalDevices > 4 ? 1 : 0))
  const offlineDevices = totalDevices - onlineDevices
  const geometryReady = walls.length > 0 || rooms.length > 0
  const healthScore = Math.min(100, 45 + buildings.length * 8 + (geometryReady ? 18 : 0) + (totalDevices > 0 ? 12 : 0) + (isApplied ? 17 : 0))
  const alarms = offlineDevices + (isApplied ? 0 : 1)
  const healthState = healthScore >= 80 ? labels.healthy : healthScore >= 55 ? labels.caution : labels.poor
  const totalFloors = buildings.reduce((sum, building) => sum + (building.total_floors ?? 0), 0)

  const events = useMemo(() => {
    const base: Array<{ severity: EventSeverity; icon: DashboardIconName; message: string; minutesAgo: number; buildingName: string | undefined }> = [
      { severity: 'info', icon: 'activity', message: labels.events.modelReady, minutesAgo: 4, buildingName: buildings[0]?.name },
      { severity: 'info', icon: 'map', message: labels.events.pointCloud, minutesAgo: 13, buildingName: buildings[0]?.name },
      { severity: totalDevices > 0 ? 'medium' : 'info', icon: 'device', message: labels.events.deviceReview, minutesAgo: 31, buildingName: buildings[1]?.name ?? buildings[0]?.name },
      { severity: isApplied ? 'info' : 'high', icon: isApplied ? 'check' : 'alert', message: isApplied ? labels.events.alignmentDone : labels.events.noAlignment, minutesAgo: 46, buildingName: buildings[0]?.name },
    ]
    return base
  }, [buildings, isApplied, labels.events, totalDevices])

  return (
    <section className="page-grid dashboard-page">
      <div className="dashboard-header-row">
        <PageHeader eyebrow={labels.eyebrow} title={labels.title} description={labels.description} />
        <Link className="btn btn-primary dashboard-header-action" to="/projects">
          {labels.newBuilding}
          <DashboardIcon name="arrow" />
        </Link>
      </div>

      <div className="dashboard-kpi-grid">
        <article className={`dashboard-kpi-card ${healthScore >= 80 ? 'up' : healthScore >= 55 ? 'neutral' : 'down'}`}>
          <span className="dashboard-kpi-icon"><DashboardIcon name="activity" /></span>
          <div>
            <span>{labels.buildingHealth}</span>
            <strong>{healthScore}<small>{labels.point}</small></strong>
            <em>{healthState}</em>
          </div>
        </article>
        <article className={onlineDevices === totalDevices ? 'dashboard-kpi-card up' : 'dashboard-kpi-card neutral'}>
          <span className="dashboard-kpi-icon"><DashboardIcon name="monitor" /></span>
          <div>
            <span>{labels.deviceStatus}</span>
            <strong>{onlineDevices}/{totalDevices}<small>{labels.online}</small></strong>
            <em>{offlineDevices} {labels.offline}</em>
          </div>
        </article>
        <article className="dashboard-kpi-card up">
          <span className="dashboard-kpi-icon"><DashboardIcon name="building" /></span>
          <div>
            <span>{labels.buildingCount}</span>
            <strong>{loadingBuildings ? '-' : buildings.length}<small>{labels.registered}</small></strong>
            <em>{totalFloors} {labels.floors}</em>
          </div>
        </article>
        <article className={alarms === 0 ? 'dashboard-kpi-card up' : 'dashboard-kpi-card down'}>
          <span className="dashboard-kpi-icon"><DashboardIcon name="alert" /></span>
          <div>
            <span>{labels.activeAlarms}</span>
            <strong>{alarms}<small>{alarms === 0 ? labels.normal : labels.checkRequired}</small></strong>
            <em>{anchors.length} {labels.alignment}</em>
          </div>
        </article>
      </div>

      <div className="dashboard-main-grid">
        <section className="dashboard-building-section">
          <div className="dashboard-section-title">
            <div>
              <span className="eyebrow-muted">{labels.geometry}</span>
              <h2>{labels.buildingList}</h2>
            </div>
            <Link className="btn btn-secondary btn-sm" to="/projects">{labels.openProjects}</Link>
          </div>

          {loadingBuildings ? (
            <div className="dashboard-empty-state">{labels.loading}</div>
          ) : buildings.length === 0 ? (
            <div className="dashboard-empty-state">
              <span className="dashboard-large-icon"><DashboardIcon name="building" /></span>
              <p>{labels.noBuildings}</p>
              <Link className="btn btn-primary" to="/projects">{labels.openProjects}</Link>
            </div>
          ) : (
            <div className="dashboard-building-grid">
              {buildings.map((building) => (
                <Link key={building.id} className="dashboard-building-card" to={`/editor/${building.id}`}>
                  <div className="dashboard-card-topline" />
                  <div className="dashboard-building-card-header">
                    <strong>{building.name}</strong>
                    <span>{building.total_floors ?? '-'} {labels.floors}</span>
                  </div>
                  {building.address && <p>{building.address}</p>}
                  <div className="dashboard-building-card-footer">
                    <span>{labels.geometry}: {walls.length + rooms.length}</span>
                    <span>{labels.devices}: {totalDevices}</span>
                  </div>
                  <em>
                    {labels.openEditor}
                    <DashboardIcon name="arrow" />
                  </em>
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="dashboard-events-panel">
          <div className="dashboard-section-title compact">
            <div>
              <span className="eyebrow-muted"><DashboardIcon name="clock" /> {events.length} {labels.eventsCount}</span>
              <h2>{labels.recentEvents}</h2>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="dashboard-empty-state">{labels.noEvents}</div>
          ) : (
            <div className="dashboard-event-list">
              {events.map((event) => (
                <article key={`${event.message}-${event.minutesAgo}`} className={`dashboard-event-item ${event.severity}`}>
                  <span className="dashboard-event-icon"><DashboardIcon name={event.icon} /></span>
                  <div>
                    <div className="dashboard-event-meta">
                      <strong>{labels.severity[event.severity]}</strong>
                      <small>{formatRelativeTime(event.minutesAgo, language)}</small>
                    </div>
                    <p>{event.message}</p>
                    {event.buildingName && <em>{event.buildingName}</em>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
