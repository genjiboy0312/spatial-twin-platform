import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft,
  Building2,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Terminal,
} from './MonitorPage/monitorIcons'

import { usePreferences } from '../app/preferences'
import { getBuildingMapSettings, type BuildingMapSettings } from '../api/buildings'
import { getFloorGeometry } from '../api/geometry'
import { getProjectSnapshot } from '../api/projectData'
import { useEditorStore } from '../stores/editorStore'
import type { Room2D, Wall2D } from '../components/Canvas2DViewer'
import type { SystemLog } from './MonitorPage/monitorTypes'

import { useMonitorData } from './MonitorPage/hooks/useMonitorData'
import { useMonitorEvents } from './MonitorPage/hooks/useMonitorEvents'
import { MonitorHeaderBar } from './MonitorPage/components/MonitorHeaderBar'
import { MonitorBuildingFloorTree } from './MonitorPage/components/MonitorBuildingFloorTree'
import { MonitorEventsPanel } from './MonitorPage/components/MonitorEventsPanel'
import { MonitorDevicePanel } from './MonitorPage/components/MonitorDevicePanel'
import { MonitorSpatialView } from './MonitorPage/components/MonitorSpatialView'
import { MonitorLogsPanel } from './MonitorPage/components/MonitorLogsPanel'
import { MonitorCameraCards } from './MonitorPage/components/MonitorCameraCards'
import { MonitorStatsPanel } from './MonitorPage/components/MonitorStatsPanel'

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
    map: 'OSM 3D Map',
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
    deviceLabels: { camera: 'Camera', sensor: 'Sensor', alarm: 'Alarm', access: 'Access' },
    severity: { info: 'Info', warning: 'Warning', critical: 'Critical' },
    logLevel: { debug: 'Debug', info: 'Info', warning: 'Warning', error: 'Error' },
  },
  ko: {
    breadcrumb: 'SOC / 모니터',
    title: '실시간 모니터',
    subtitle: '장치 상태, 지도, 실시간 이벤트, 시스템 로그를 한 화면에서 보는 운영 콘솔입니다.',
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
    map: '지도',
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
    deviceLabels: { camera: '카메라', sensor: '센서', alarm: '알람', access: '출입' },
    severity: { info: '정보', warning: '주의', critical: '긴급' },
    logLevel: { debug: '디버그', info: '정보', warning: '주의', error: '오류' },
  },
} as const

type MonitorAlignmentSnapshot = {
  buildingOrigin: [number, number] | null
  alignmentMatrix: number[][] | null
  osmQuadZoom: number | null
  osmQuadScale: number | null
  osmQuadOpacity: number | null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isLatLngTuple(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && isFiniteNumber(value[0])
    && isFiniteNumber(value[1])
}

function isAlignmentMatrix(value: unknown): value is number[][] {
  return Array.isArray(value)
    && value.length === 2
    && value.every((row) => Array.isArray(row)
      && row.length >= 3
      && row.slice(0, 3).every(isFiniteNumber))
}

function parseAlignmentSnapshot(value: unknown): MonitorAlignmentSnapshot | null {
  if (typeof value !== 'object' || value === null) return null
  const snapshot = value as Record<string, unknown>
  return {
    buildingOrigin: isLatLngTuple(snapshot.buildingOrigin) ? snapshot.buildingOrigin : null,
    alignmentMatrix: isAlignmentMatrix(snapshot.alignmentMatrix) ? snapshot.alignmentMatrix : null,
    osmQuadZoom: isFiniteNumber(snapshot.osmQuadZoom) ? snapshot.osmQuadZoom : null,
    osmQuadScale: isFiniteNumber(snapshot.osmQuadScale) ? snapshot.osmQuadScale : null,
    osmQuadOpacity: isFiniteNumber(snapshot.osmQuadOpacity) ? snapshot.osmQuadOpacity : null,
  }
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--:--'
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function MonitorPage() {
  const { language } = usePreferences()
  const labels = copy[language]
  const editorWalls = useEditorStore((state) => state.walls)
  const editorRooms = useEditorStore((state) => state.rooms)
  const loadSample = useEditorStore((state) => state.loadSample)

  const {
    buildings,
    floors,
    selectedBuildingId,
    selectedFloorId,
    selectedBuilding,
    selectedFloor,
    devices,
    cameras,
    setSelectedBuildingId,
    setSelectedFloorId,
  } = useMonitorData()

  const { events, summary, connectionState, refresh: refreshEvents } = useMonitorEvents(language)

  // Local UI state
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [showPointCloud, setShowPointCloud] = useState(true)
  const [showGps, setShowGps] = useState(false)
  const [showCoverage, setShowCoverage] = useState(true)
  const [bottomTab, setBottomTab] = useState<'logs' | 'cameras'>('logs')
  const [bottomExpanded, setBottomExpanded] = useState(true)
  const [mapSettings, setMapSettings] = useState<BuildingMapSettings | null>(null)
  const [alignmentSnapshot, setAlignmentSnapshot] = useState<MonitorAlignmentSnapshot | null>(null)
  const [floorGeometry, setFloorGeometry] = useState<{ walls: Wall2D[]; rooms: Room2D[] }>({ walls: [], rooms: [] })
  const [floorGeometryLoaded, setFloorGeometryLoaded] = useState(false)

  useEffect(() => {
    if (editorWalls.length === 0 && editorRooms.length === 0) loadSample()
  }, [editorRooms.length, editorWalls.length, loadSample])

  useEffect(() => {
    let cancelled = false
    setFloorGeometryLoaded(false)
    if (selectedFloorId === null) {
      setFloorGeometry({ walls: [], rooms: [] })
      setFloorGeometryLoaded(true)
      return
    }

    getFloorGeometry(selectedFloorId)
      .then((geometry) => {
        if (!cancelled) {
          setFloorGeometry({ walls: geometry.walls, rooms: geometry.rooms })
          setFloorGeometryLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFloorGeometry({ walls: [], rooms: [] })
          setFloorGeometryLoaded(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedFloorId])

  const walls = floorGeometryLoaded ? floorGeometry.walls : editorWalls
  const rooms = floorGeometryLoaded ? floorGeometry.rooms : editorRooms

  useEffect(() => {
    let cancelled = false
    if (selectedBuildingId === null) {
      setMapSettings(null)
      setAlignmentSnapshot(null)
      return
    }
    getBuildingMapSettings(selectedBuildingId)
      .then((settings) => {
        if (!cancelled) setMapSettings(settings)
      })
      .catch(() => {
        if (!cancelled) setMapSettings(null)
      })
    getProjectSnapshot(selectedBuildingId)
      .then((snapshot) => {
        if (!cancelled) setAlignmentSnapshot(parseAlignmentSnapshot(snapshot.state.alignment))
      })
      .catch(() => {
        if (!cancelled) setAlignmentSnapshot(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedBuildingId])

  const logs: SystemLog[] = useMemo(
    () => events.slice(0, 12).map((event, index) => ({
      id: index,
      level: event.severity === 'critical' ? 'error' : event.severity === 'warning' ? 'warning' : index % 3 === 0 ? 'debug' : 'info',
      source: event.source,
      message: event.message,
      timestamp: event.timestamp,
    })),
    [events],
  )

  const resetLayout = () => {
    setBottomTab('logs')
    setBottomExpanded(true)
    setShowCoverage(true)
    setShowPointCloud(true)
    setShowGps(false)
  }

  const handleRefresh = () => { refreshEvents() }

  return (
    <section className="monitor-page">
      <div className="monitor-complete-banner">
        <span>
          <CheckCircle2 size={16} />
          {labels.complete}
        </span>
        <Link className="monitor-link-button" to="/validation">
          <ArrowLeft size={14} />
          {labels.validation}
        </Link>
      </div>

      <MonitorHeaderBar
        breadcrumb={labels.breadcrumb}
        title={labels.title}
        subtitle={labels.subtitle}
        showPointCloud={showPointCloud}
        onTogglePointCloud={setShowPointCloud}
        pointCloudCount={1}
        showGps={showGps}
        onToggleGps={setShowGps}
        gpsCount={showGps ? 3 : 0}
        showCoverage={showCoverage}
        onToggleCoverage={setShowCoverage}
        connectionState={connectionState}
        onResetLayout={resetLayout}
        onRefresh={handleRefresh}
      />

      {buildings.length === 0 ? (
        <div className="monitor-empty-state">
          <Building2 size={42} strokeWidth={1.5} />
          <strong>{labels.noBuildings}</strong>
          <Link className="monitor-link-button" to="/projects">
            {labels.openProjects}
          </Link>
        </div>
      ) : (
        <div className="monitor-workspace">
          <aside className="monitor-panel">
            <MonitorDevicePanel
              devices={devices}
              selectedDeviceId={selectedDeviceId}
              labels={{
                all: labels.all,
                search: labels.search,
                deviceLabels: labels.deviceLabels,
                noMatch: labels.noMatch,
                emptyDevices: labels.emptyDevices,
                online: labels.online,
              }}
              onSelect={setSelectedDeviceId}
            />
            <MonitorStatsPanel
              deviceCount={devices.length}
              eventCount={events.length}
              alertCount={summary.critical + summary.warning}
              selectedBuildingName={selectedBuilding?.name ?? null}
              selectedFloorName={selectedFloor?.floor_name ?? null}
            />
          </aside>

          <main className="monitor-panel monitor-center-panel">
            <div className="monitor-panel-title overlay">
              <span>{labels.map}</span>
              <strong>
                {selectedFloor?.floor_name ?? selectedBuilding?.name ?? labels.map}
              </strong>
            </div>
            <MonitorSpatialView
              building={selectedBuilding}
              mapSettings={mapSettings}
              alignmentSnapshot={alignmentSnapshot}
              floors={floors}
              selectedFloorId={selectedFloorId}
              walls={walls}
              rooms={rooms}
              devices={devices}
              selectedDeviceId={selectedDeviceId}
              showCoverage={showCoverage}
              showGps={showGps}
              showPointCloud={showPointCloud}
              onSelectDevice={setSelectedDeviceId}
            />
          </main>

          <aside className="monitor-panel monitor-right-panel">
            <div className="monitor-tree-panel monitor-tree-panel-compact">
              <MonitorBuildingFloorTree
                buildings={buildings}
                floors={floors}
                selectedBuildingId={selectedBuildingId}
                selectedFloorId={selectedFloorId}
                labels={{ buildingFloors: labels.buildingFloors, floors: labels.floors }}
                onBuildingSelect={setSelectedBuildingId}
                onFloorSelect={setSelectedFloorId}
              />
            </div>
            <div className="monitor-right-events">
              <MonitorEventsPanel
                events={events}
                labels={{ severity: labels.severity, eventFeed: labels.eventFeed }}
                noEvents={labels.noEvents}
                formatTime={formatTime}
              />
            </div>
          </aside>
        </div>
      )}

      <div className="monitor-bottom-panel">
        <div className="monitor-bottom-header">
          <div>
            {([
              { id: 'logs' as const, label: labels.logs, Icon: Terminal, count: logs.length },
              { id: 'cameras' as const, label: labels.cameras, Icon: Camera, count: cameras.length },
            ]).map(({ id, label, Icon, count }) => {
              const active = bottomTab === id
              return (
                <button
                  key={id}
                  type="button"
                  className={active ? 'active' : ''}
                  onClick={() => { setBottomTab(id); setBottomExpanded(true) }}
                >
                  <Icon size={13} />
                  {label}
                  <small>{count}</small>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => setBottomExpanded((prev) => !prev)}
          >
            {bottomExpanded
              ? <ChevronDown size={14} />
              : <ChevronUp size={14} />
            }
          </button>
        </div>

        {bottomExpanded && (
          <div className="monitor-bottom-body">
            {bottomTab === 'logs' ? (
              <MonitorLogsPanel
                logs={logs}
                formatTime={formatTime}
                logLevelLabels={labels.logLevel}
              />
            ) : (
              <MonitorCameraCards
                cameras={cameras}
                selectedDeviceId={selectedDeviceId}
                labels={{ online: labels.online, noCameras: labels.noCameras }}
                onSelect={setSelectedDeviceId}
              />
            )}
          </div>
        )}
      </div>

      {selectedDeviceId && devices.find((d) => d.id === selectedDeviceId) && (
        <div className="monitor-selection-toast">
          <MapPin size={14} />
          <span>{labels.selected}: {devices.find((d) => d.id === selectedDeviceId)?.name}</span>
        </div>
      )}
    </section>
  )
}
