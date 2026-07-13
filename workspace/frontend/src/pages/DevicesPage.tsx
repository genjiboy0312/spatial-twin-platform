import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { listBuildings, type Building } from '../api/buildings'
import { getProjectData, type ProjectData, type ProjectSecurityDevice } from '../api/projectData'
import { usePreferences } from '../app/preferences'
import { Bell, Camera, DoorOpen, Radio } from '../components/Icons'
import { DEVICE_COLORS, DEVICE_TYPE_EN_LABELS, DEVICE_TYPE_LABELS, DEVICE_TYPE_LIST } from '../constants/devices'
import type { SecurityDevice, SecurityDeviceType } from '../stores/editorStore'
import { preferredBuildingId, useProjectSelectionSync, useProjectStore } from '../stores/projectStore'
import { deviceFromObjectPlacement } from '../utils/projectObjectPlacements'
import { PageHeader } from './PageHeader'

const copy = {
  en: {
    eyebrow: 'Devices',
    title: 'Device Management',
    description: 'Review placed security devices, coverage readiness, and monitoring handoff from one operations page.',
    total: 'Total devices',
    online: 'Online',
    coverage: 'Coverage ready',
    review: 'Review queue',
    openEditor: 'Open 3D Editor',
    monitor: 'Open Monitor',
    inventory: 'Device inventory',
    distribution: 'Type distribution',
    detail: 'Selected device',
    noSelection: 'Select a device from the inventory to inspect placement details.',
    placement: 'Placement guide',
    emptyTitle: 'No devices placed',
    emptyBody: 'Open the 3D Editor, switch to device placement, and add cameras, sensors, alarms, or access devices.',
    name: 'Name',
    type: 'Type',
    position: 'Position',
    status: 'Status',
    angle: 'Angle',
    active: 'Active',
    ready: 'Ready',
    needsReview: 'Needs review',
    editorHint: 'Device data is shared with the editor scene, so placement changes appear here immediately.',
  },
  ko: {
    eyebrow: '장치',
    title: '장치 관리',
    description: '에디터에 배치된 보안 장치, 커버리지 준비 상태, 모니터링 연계를 한 화면에서 확인합니다.',
    total: '전체 장치',
    online: '온라인',
    coverage: '커버리지 준비',
    review: '검토 필요',
    openEditor: '3D 편집 열기',
    monitor: '모니터 열기',
    inventory: '장치 인벤토리',
    distribution: '유형별 분포',
    detail: '선택 장치',
    noSelection: '인벤토리에서 장치를 선택하면 배치 상세 정보를 확인할 수 있습니다.',
    placement: '배치 가이드',
    emptyTitle: '배치된 장치가 없습니다',
    emptyBody: '3D 편집 화면에서 장치 배치 모드로 전환한 뒤 카메라, 센서, 알람, 출입 장치를 추가하세요.',
    name: '이름',
    type: '유형',
    position: '위치',
    status: '상태',
    angle: '각도',
    active: '활성',
    ready: '준비됨',
    needsReview: '검토 필요',
    editorHint: '장치 데이터는 에디터 씬과 공유되므로 배치 변경 사항이 이 페이지에 바로 반영됩니다.',
  },
} as const

type InventoryDevice = SecurityDevice & {
  floor_id: number | null
  source: 'object-placement' | 'security-device'
}

const placementGuides = {
  en: [
    'Place cameras on corridors or entrances and verify their view angle.',
    'Use sensors for rooms, windows, and blind spots that need event detection.',
    'Review alarms and access devices before handing the layout to monitoring.',
  ],
  ko: [
    '카메라는 복도와 출입구 중심으로 배치하고 시야각을 확인하세요.',
    '센서는 이벤트 감지가 필요한 실, 창문, 사각지대에 배치하세요.',
    '알람과 출입 장치는 모니터링 단계로 넘기기 전에 위치를 검토하세요.',
  ],
} as const

function getDeviceLabel(language: 'en' | 'ko', type: SecurityDeviceType) {
  return language === 'ko' ? DEVICE_TYPE_LABELS[type] : DEVICE_TYPE_EN_LABELS[type]
}

function formatPosition(device: SecurityDevice) {
  return `${device.x.toFixed(2)}, ${device.y.toFixed(2)}`
}

function isSecurityDeviceType(value: unknown): value is SecurityDeviceType {
  return typeof value === 'string' && DEVICE_TYPE_LIST.includes(value as SecurityDeviceType)
}

function legacySecurityDeviceToInventory(device: ProjectSecurityDevice): InventoryDevice | null {
  if (!isSecurityDeviceType(device.device_type)) return null
  return {
    id: `security-${device.id}`,
    name: device.name,
    device_type: device.device_type,
    x: device.pos_x,
    y: device.pos_y,
    angle: device.angle,
    floor_id: device.floor_id,
    source: 'security-device',
  }
}

function devicesFromProjectData(data: ProjectData): InventoryDevice[] {
  const placementDevices = data.object_placements
    .map(deviceFromObjectPlacement)
    .filter((device): device is NonNullable<ReturnType<typeof deviceFromObjectPlacement>> => device !== null)
    .map((device): InventoryDevice => ({
      ...device,
      source: 'object-placement',
    }))

  const placementLegacyIds = new Set(
    placementDevices
      .map((device) => device.id)
      .filter((id) => id.startsWith('security-')),
  )
  const securityDevices = data.security_devices
    .map(legacySecurityDeviceToInventory)
    .filter((device): device is InventoryDevice => device !== null)
    .filter((device) => !placementLegacyIds.has(device.id))

  return [...placementDevices, ...securityDevices]
}

function DeviceTypeIcon({ type, size = 16 }: { type: SecurityDeviceType; size?: number }) {
  const Icon = {
    camera: Camera,
    sensor: Radio,
    alarm: Bell,
    access: DoorOpen,
  }[type]
  return <Icon size={size} />
}

export function DevicesPage() {
  const { language } = usePreferences()
  const labels = copy[language]
  const setGlobalSelectedBuildingId = useProjectStore((state) => state.setSelectedBuildingId)
  const globalSelectedBuildingId = useProjectStore((state) => state.selectedBuildingId)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [devices, setDevices] = useState<InventoryDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  useProjectSelectionSync(buildings, selectedBuildingId, setSelectedBuildingId)
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? null

  const loadBuildings = useCallback(async () => {
    try {
      const data = await listBuildings()
      setBuildings(data)
      setSelectedBuildingId((current) => {
        const next = preferredBuildingId(data, current ?? globalSelectedBuildingId)
        setGlobalSelectedBuildingId(next)
        return next
      })
    } catch {
      setBuildings([])
      setSelectedBuildingId(null)
    }
  }, [globalSelectedBuildingId, setGlobalSelectedBuildingId])

  useEffect(() => {
    loadBuildings()
  }, [loadBuildings])

  useEffect(() => {
    let cancelled = false
    if (selectedBuildingId === null) {
      setDevices([])
      setSelectedDeviceId(null)
      return
    }

    getProjectData(selectedBuildingId)
      .then((data) => {
        if (cancelled) return
        const nextDevices = devicesFromProjectData(data)
        setDevices(nextDevices)
        setSelectedDeviceId((current) => (
          current && nextDevices.some((device) => device.id === current) ? current : null
        ))
      })
      .catch(() => {
        if (!cancelled) {
          setDevices([])
          setSelectedDeviceId(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedBuildingId])

  const counts = useMemo(() => DEVICE_TYPE_LIST.reduce<Record<SecurityDeviceType, number>>((acc, type) => {
    acc[type] = devices.filter((device) => device.device_type === type).length
    return acc
  }, { camera: 0, sensor: 0, alarm: 0, access: 0 }), [devices])

  const reviewCount = devices.filter((device) => device.device_type === 'alarm' || device.device_type === 'access').length
  const coverageReady = devices.filter((device) => device.device_type === 'camera' || device.device_type === 'sensor').length

  return (
    <section className="page-grid spatial-page devices-page">
      <PageHeader eyebrow={labels.eyebrow} title={labels.title} description={labels.description} />

      <div className="devices-hero-panel">
        <div>
          <span className="eyebrow-muted">Operations handoff</span>
          <h3>{devices.length > 0 ? `${devices.length} ${labels.total}` : labels.emptyTitle}</h3>
          <p>{devices.length > 0 ? labels.editorHint : labels.emptyBody}</p>
        </div>
        <div className="devices-hero-actions">
          {buildings.length > 0 && (
            <select
              className="select-input"
              value={selectedBuildingId ?? ''}
              onChange={(event) => {
                const next = event.target.value ? Number(event.target.value) : null
                setSelectedBuildingId(next)
                setGlobalSelectedBuildingId(next)
              }}
              aria-label="Building context"
            >
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          )}
          <Link className="btn btn-secondary" to="/monitor">{labels.monitor}</Link>
          <Link className="btn btn-primary" to="/editor">{labels.openEditor}</Link>
        </div>
      </div>

      <div className="devices-kpi-grid">
        <article className="devices-kpi-card">
          <span>{labels.total}</span>
          <strong>{devices.length}</strong>
          <small>{labels.active}</small>
        </article>
        <article className="devices-kpi-card">
          <span>{labels.online}</span>
          <strong>{devices.length}</strong>
          <small>100%</small>
        </article>
        <article className="devices-kpi-card">
          <span>{labels.coverage}</span>
          <strong>{coverageReady}</strong>
          <small>{labels.ready}</small>
        </article>
        <article className="devices-kpi-card warning">
          <span>{labels.review}</span>
          <strong>{reviewCount}</strong>
          <small>{labels.needsReview}</small>
        </article>
      </div>

      <div className="devices-command-layout">
        <main className="devices-panel devices-inventory-panel">
          <div className="spatial-card-topline" />
          <div className="devices-panel-header">
            <div>
              <span className="eyebrow-muted">{labels.inventory}</span>
              <h3>{devices.length}</h3>
            </div>
            <span className="devices-status-pill">{labels.online}</span>
          </div>

          {devices.length === 0 ? (
            <div className="devices-empty-state">
              <strong>{labels.emptyTitle}</strong>
              <p>{labels.emptyBody}</p>
              <Link className="btn btn-primary" to="/editor">{labels.openEditor}</Link>
            </div>
          ) : (
            <div className="devices-table">
              <div className="devices-table-row head">
                <span>{labels.name}</span>
                <span>{labels.type}</span>
                <span>{labels.position}</span>
                <span>{labels.status}</span>
              </div>
              {devices.map((device, index) => (
                <button
                  key={device.id}
                  className={`devices-table-row ${selectedDeviceId === device.id ? 'selected' : ''}`}
                  type="button"
                  onClick={() => setSelectedDeviceId(selectedDeviceId === device.id ? null : device.id)}
                >
                  <span className="devices-name-cell">
                    <i style={{ background: DEVICE_COLORS[device.device_type] }}>
                      <DeviceTypeIcon type={device.device_type} />
                    </i>
                    <strong>{device.name || `${getDeviceLabel(language, device.device_type)} #${index + 1}`}</strong>
                  </span>
                  <span>{getDeviceLabel(language, device.device_type)}</span>
                  <span>{formatPosition(device)}</span>
                  <span className="devices-status-text">{labels.active}</span>
                </button>
              ))}
            </div>
          )}
        </main>

        <aside className="devices-side-stack">
          <section className="devices-panel">
            <div className="spatial-card-topline muted" />
            <div className="devices-panel-header">
              <div>
                <span className="eyebrow-muted">{labels.distribution}</span>
                <h3>{labels.type}</h3>
              </div>
            </div>
            <div className="devices-type-grid">
              {DEVICE_TYPE_LIST.map((type) => (
                <div key={type} className="devices-type-card">
                  <span className="devices-type-icon" style={{ background: DEVICE_COLORS[type] }}>
                    <DeviceTypeIcon type={type} />
                  </span>
                  <span>{getDeviceLabel(language, type)}</span>
                  <strong>{counts[type]}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="devices-panel">
            <div className="devices-panel-header">
              <div>
                <span className="eyebrow-muted">{labels.detail}</span>
                <h3>{selectedDevice ? selectedDevice.name : '-'}</h3>
              </div>
            </div>
            {selectedDevice ? (
              <div className="devices-detail-list">
                <p><span>{labels.type}</span><strong>{getDeviceLabel(language, selectedDevice.device_type)}</strong></p>
                <p><span>{labels.position}</span><strong>{formatPosition(selectedDevice)}</strong></p>
                <p><span>{labels.angle}</span><strong>{selectedDevice.angle ?? 0}°</strong></p>
                <p><span>{labels.status}</span><strong>{labels.active}</strong></p>
              </div>
            ) : (
              <p className="devices-muted-copy">{labels.noSelection}</p>
            )}
          </section>

          <section className="devices-panel">
            <div className="devices-panel-header">
              <div>
                <span className="eyebrow-muted">{labels.placement}</span>
                <h3>Checklist</h3>
              </div>
            </div>
            <ol className="devices-guide-list">
              {placementGuides[language].map((guide) => (
                <li key={guide}>{guide}</li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </section>
  )
}
