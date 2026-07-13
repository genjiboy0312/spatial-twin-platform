import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { listBuildings, type Building } from '../api/buildings'
import { createFloor, listFloors, type Floor } from '../api/floors'
import { usePreferences } from '../app/preferences'
import { preferredBuildingId, useProjectSelectionSync, useProjectStore } from '../stores/projectStore'
import { CreateBuildingModal } from './CreateBuildingModal'
import { FloorCreateModal } from '../components/FloorCreateModal'
import { PageHeader } from './PageHeader'

type ProjectIconName = 'building' | 'plus' | 'pin' | 'layers' | 'editor' | 'data' | 'check' | 'arrow'

const copy = {
  en: {
    eyebrow: 'Step 1',
    title: 'Projects',
    description: 'Select a building workspace, inspect its floor stack, and continue into data, editing, or validation.',
    assets: 'Assets',
    buildingList: 'Building List',
    create: 'Create Building',
    noBuildings: 'Create the first building workspace to start the project.',
    loading: 'Loading buildings...',
    retry: 'Retry',
    errorTitle: 'Error',
    noAddress: 'No address',
    noCreatedAt: 'No creation time',
    selectedFacility: 'Selected Facility',
    commandPreview: 'Command Preview',
    preview: 'Building Preview',
    online: 'Online',
    standby: 'Standby',
    selectBuilding: 'Select a building from the list.',
    buildingId: 'Building ID',
    floors: 'Floors',
    floorMatrix: 'Floor Matrix',
    floorConfig: 'Floor configuration',
    noFloors: 'No floors registered yet.',
    gpsCoords: 'GPS Coordinates',
    gpsNotSet: 'GPS origin not set',
    operations: 'Operations',
    detailInfo: 'Project Detail',
    buildingName: 'Building Name',
    address: 'Address',
    stackControl: 'Stack Control',
    floorManage: 'Floor Manager',
    addFloor: 'Add Floor',
    quickMove: 'Quick Move',
    openData: 'Open Data Sources',
    openEditor: 'Open 3D Editor',
    openValidation: 'Run Validation',
    statusReady: 'Ready',
    statusNeedsData: 'Needs Data',
    created: 'Created',
    floorSuffix: 'F',
    promptFloorNumber: 'Floor number?',
    promptFloorName: 'Floor name?',
  },
  ko: {
    eyebrow: 'Step 1',
    title: '프로젝트',
    description: '건물 워크스페이스를 선택하고, 층 구성과 좌표 상태를 확인한 뒤 데이터/편집/검증으로 이어갑니다.',
    assets: '자산',
    buildingList: '건물 목록',
    create: '건물 생성',
    noBuildings: '프로젝트를 시작하려면 첫 건물 워크스페이스를 생성하세요.',
    loading: '건물 목록을 불러오는 중...',
    retry: '다시 시도',
    errorTitle: '오류',
    noAddress: '주소 정보 없음',
    noCreatedAt: '생성 시간 정보 없음',
    selectedFacility: '선택된 시설',
    commandPreview: '커맨드 프리뷰',
    preview: '건물 프리뷰',
    online: '온라인',
    standby: '대기',
    selectBuilding: '목록에서 건물을 선택하세요.',
    buildingId: '건물 ID',
    floors: '층수',
    floorMatrix: '층 매트릭스',
    floorConfig: '층 구성',
    noFloors: '아직 등록된 층이 없습니다.',
    gpsCoords: 'GPS 좌표',
    gpsNotSet: 'GPS 원점 미설정',
    operations: '운영',
    detailInfo: '프로젝트 상세',
    buildingName: '건물명',
    address: '주소',
    stackControl: '스택 제어',
    floorManage: '층 관리',
    addFloor: '층 추가',
    quickMove: '빠른 이동',
    openData: '데이터소스 열기',
    openEditor: '3D편집 열기',
    openValidation: '검증 실행',
    statusReady: '준비됨',
    statusNeedsData: '데이터 필요',
    created: '생성',
    floorSuffix: '층',
    promptFloorNumber: '층 번호를 입력하세요.',
    promptFloorName: '층 이름을 입력하세요.',
  },
} as const

type BuildingWithCreatedAt = Building & {
  created_at?: string | null
}

function ProjectIcon({ name }: { name: ProjectIconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
  } as const

  const icons = {
    building: <path {...common} d="M4 20V7l8-4 8 4v13M8 20v-7h8v7M8 8h.01M12 7h.01M16 8h.01" />,
    plus: <path {...common} d="M12 5v14M5 12h14" />,
    pin: (
      <>
        <path {...common} d="M12 21s7-5.2 7-12A7 7 0 0 0 5 9c0 6.8 7 12 7 12Z" />
        <circle {...common} cx="12" cy="9" r="2" />
      </>
    ),
    layers: <path {...common} d="m12 3 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4" />,
    editor: <path {...common} d="M5 19h4l10-10a2.1 2.1 0 0 0-3-3L6 16zM13.5 6.5l4 4" />,
    data: (
      <>
        <ellipse {...common} cx="12" cy="6" rx="7" ry="3" />
        <path {...common} d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
      </>
    ),
    check: <path {...common} d="m5 12 4 4L19 6" />,
    arrow: <path {...common} d="M5 12h14M13 6l6 6-6 6" />,
  } satisfies Record<ProjectIconName, React.ReactNode>

  return (
    <svg aria-hidden="true" className="project-icon-svg" viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  )
}

function formatCreatedAt(building: Building, fallback: string): string {
  const createdAt = (building as BuildingWithCreatedAt).created_at
  if (!createdAt) return fallback

  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return fallback

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function floorLabel(floor: Floor, suffix: string) {
  return floor.floor_name ?? `${floor.floor_number}${suffix}`
}

export function ProjectsPage() {
  const { language } = usePreferences()
  const labels = copy[language]
  const setGlobalSelectedBuildingId = useProjectStore((state) => state.setSelectedBuildingId)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [floors, setFloors] = useState<Floor[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [floorsLoading, setFloorsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showFloorModal, setShowFloorModal] = useState(false)
  const [creatingFloor, setCreatingFloor] = useState(false)

  const selectedBuilding = useMemo(
    () => buildings.find((building) => building.id === selectedBuildingId) ?? null,
    [buildings, selectedBuildingId],
  )
  useProjectSelectionSync(buildings, selectedBuildingId, setSelectedBuildingId)

  const sortedFloors = useMemo(() => floors.slice().sort((a, b) => b.floor_number - a.floor_number), [floors])
  const nextFloorNumber = useMemo(() => Math.max(0, ...floors.map((floor) => floor.floor_number)) + 1, [floors])
  const existingFloorNumbers = useMemo(() => floors.map((floor) => floor.floor_number), [floors])

  const fetchBuildings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listBuildings()
      setBuildings(data)
      setSelectedBuildingId((current) => {
        const next = preferredBuildingId(data, current)
        setGlobalSelectedBuildingId(next)
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load buildings')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchFloors = useCallback(async (buildingId: number) => {
    setFloorsLoading(true)
    try {
      setFloors(await listFloors(buildingId))
    } catch {
      setFloors([])
    } finally {
      setFloorsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBuildings()
  }, [fetchBuildings])

  useEffect(() => {
    if (selectedBuildingId === null) {
      setFloors([])
      return
    }
    fetchFloors(selectedBuildingId)
  }, [fetchFloors, selectedBuildingId])

  const handleCreated = async () => {
    await fetchBuildings()
    setShowModal(false)
  }

  const handleCreateFloor = async ({ floorNumber, floorName }: { floorNumber: number; floorName: string }) => {
    if (!selectedBuilding) return
    setCreatingFloor(true)
    try {
      await createFloor(selectedBuilding.id, {
        floor_number: floorNumber,
        floor_name: floorName,
        height_meters: 3.2,
        input_type: 'manual',
      })
      await fetchFloors(selectedBuilding.id)
      setShowFloorModal(false)
    } finally {
      setCreatingFloor(false)
    }
  }

  return (
    <section className="page-grid projects-command-page">
      <PageHeader eyebrow={labels.eyebrow} title={labels.title} description={labels.description} />

      <div className="projects-command-layout">
        <aside className="project-panel project-list-panel">
          <div className="project-card-topline" />
          <div className="project-panel-header">
            <div>
              <span className="eyebrow-muted">{labels.assets}</span>
              <h3>{labels.buildingList}</h3>
            </div>
            <div className="project-header-actions">
              <span className="project-badge info">{buildings.length}</span>
              <button className="project-icon-button" type="button" onClick={() => setShowModal(true)} aria-label={labels.create}>
                <ProjectIcon name="plus" />
              </button>
            </div>
          </div>

          {loading && (
            <div className="project-empty-state">
              <p>{labels.loading}</p>
            </div>
          )}

          {!loading && error && (
            <div className="project-empty-state error">
              <strong>{labels.errorTitle}</strong>
              <p>{error}</p>
              <button className="btn btn-secondary" type="button" onClick={fetchBuildings}>
                {labels.retry}
              </button>
            </div>
          )}

          {!loading && !error && buildings.length === 0 && (
            <div className="project-empty-state">
              <span className="project-icon-box large">
                <ProjectIcon name="building" />
              </span>
              <p>{labels.noBuildings}</p>
              <button className="btn btn-primary" type="button" onClick={() => setShowModal(true)}>
                {labels.create}
              </button>
            </div>
          )}

          {!loading && !error && buildings.length > 0 && (
            <div className="project-building-list">
              {buildings.map((building) => {
                const isSelected = building.id === selectedBuildingId
                return (
                  <button
                    key={building.id}
                    className={`project-building-item ${isSelected ? 'selected' : ''}`}
                    type="button"
                    onClick={() => {
                      setSelectedBuildingId(building.id)
                      setGlobalSelectedBuildingId(building.id)
                    }}
                  >
                    <span className="project-icon-box">
                      <ProjectIcon name="building" />
                    </span>
                    <span className="project-building-copy">
                      <strong>{building.name}</strong>
                      <small>#{building.id}</small>
                      <em>
                        <ProjectIcon name="pin" />
                        {building.address ?? labels.noAddress}
                      </em>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        <main className="project-panel project-preview-panel">
          <div className="project-card-topline teal" />
          <div className="project-panel-header">
            <div>
              <span className="eyebrow-muted">{labels.commandPreview}</span>
              <h3>{labels.preview}</h3>
            </div>
            <span className={`project-badge ${selectedBuilding ? 'success' : 'neutral'}`}>
              {selectedBuilding ? labels.online : labels.standby}
            </span>
          </div>

          {!selectedBuilding ? (
            <div className="project-preview-empty">
              <span className="project-icon-box hero">
                <ProjectIcon name="building" />
              </span>
              <p>{labels.selectBuilding}</p>
            </div>
          ) : (
            <div className="project-preview-stack">
              <section className="project-selected-hero">
                <div>
                  <span className="eyebrow-muted">{labels.selectedFacility}</span>
                  <h2>{selectedBuilding.name}</h2>
                  <p>
                    <ProjectIcon name="pin" />
                    {selectedBuilding.address ?? labels.noAddress}
                  </p>
                </div>
                <div className="project-stat-grid">
                  <div>
                    <span>{labels.buildingId}</span>
                    <strong>#{selectedBuilding.id}</strong>
                  </div>
                  <div>
                    <span>{labels.floors}</span>
                    <strong>
                      <ProjectIcon name="layers" />
                      {selectedBuilding.total_floors}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="project-floor-card">
                <div className="project-panel-header compact">
                  <div>
                    <span className="eyebrow-muted">{labels.floorMatrix}</span>
                    <h3>{labels.floorConfig}</h3>
                  </div>
                  <span className="project-badge success">{floors.length || selectedBuilding.total_floors}</span>
                </div>

                {floorsLoading ? (
                  <div className="project-empty-state compact">
                    <p>{labels.loading}</p>
                  </div>
                ) : sortedFloors.length === 0 ? (
                  <div className="project-generated-floors">
                    {Array.from({ length: Math.min(selectedBuilding.total_floors, 12) }, (_, index) => {
                      const floorNumber = selectedBuilding.total_floors - index
                      return (
                        <span key={floorNumber}>
                          {floorNumber}
                          {labels.floorSuffix}
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <div className="project-generated-floors">
                    {sortedFloors.map((floor) => (
                      <span key={floor.id}>{floorLabel(floor, labels.floorSuffix)}</span>
                    ))}
                  </div>
                )}
              </section>

              <section className="project-gps-card">
                <span className="eyebrow-muted">{labels.gpsCoords}</span>
                <strong>
                  <ProjectIcon name="pin" />
                  {selectedBuilding.origin_latitude != null && selectedBuilding.origin_longitude != null
                    ? `${selectedBuilding.origin_latitude.toFixed(6)}, ${selectedBuilding.origin_longitude.toFixed(6)}`
                    : labels.gpsNotSet}
                </strong>
              </section>
            </div>
          )}
        </main>

        <aside className="project-panel project-detail-panel">
          <div className="project-card-topline" />
          <div className="project-panel-header">
            <div>
              <span className="eyebrow-muted">{labels.operations}</span>
              <h3>{labels.detailInfo}</h3>
            </div>
          </div>

          {!selectedBuilding ? (
            <div className="project-empty-state">
              <p>{labels.selectBuilding}</p>
            </div>
          ) : (
            <div className="project-detail-stack">
              <div className="project-detail-field">
                <span>{labels.buildingName}</span>
                <strong>{selectedBuilding.name}</strong>
              </div>
              <div className="project-detail-field">
                <span>{labels.address}</span>
                <p>{selectedBuilding.address ?? labels.noAddress}</p>
              </div>
              <div className="project-detail-field">
                <span>{labels.created}</span>
                <p>{formatCreatedAt(selectedBuilding, labels.noCreatedAt)}</p>
              </div>

              <section className="project-floor-manager">
                <div className="project-panel-header compact">
                  <div>
                    <span className="eyebrow-muted">{labels.stackControl}</span>
                    <h3>{labels.floorManage}</h3>
                  </div>
                  <button className="project-icon-button" type="button" onClick={() => setShowFloorModal(true)} aria-label={labels.addFloor}>
                    <ProjectIcon name="plus" />
                  </button>
                </div>

                {sortedFloors.length === 0 ? (
                  <p className="project-muted-text">{labels.noFloors}</p>
                ) : (
                  <div className="project-floor-list">
                    {sortedFloors.map((floor) => (
                      <span key={floor.id}>
                        <strong>{floorLabel(floor, labels.floorSuffix)}</strong>
                        <small>#{floor.id} / {floor.height_meters}m</small>
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <section className="project-quick-actions">
                <span className="eyebrow-muted">{labels.quickMove}</span>
                <Link className="project-action-link" to="/data-sources">
                  <ProjectIcon name="data" />
                  {labels.openData}
                  <ProjectIcon name="arrow" />
                </Link>
                <Link className="project-action-link" to={`/editor/${selectedBuilding.id}`}>
                  <ProjectIcon name="editor" />
                  {labels.openEditor}
                  <ProjectIcon name="arrow" />
                </Link>
                <Link className="project-action-link" to="/validation">
                  <ProjectIcon name="check" />
                  {labels.openValidation}
                  <ProjectIcon name="arrow" />
                </Link>
              </section>
            </div>
          )}
        </aside>
      </div>

      {showModal && <CreateBuildingModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
      <FloorCreateModal
        isOpen={showFloorModal}
        language={language}
        defaultFloorNumber={nextFloorNumber}
        existingFloorNumbers={existingFloorNumbers}
        isSubmitting={creatingFloor}
        onClose={() => setShowFloorModal(false)}
        onSubmit={handleCreateFloor}
      />
    </section>
  )
}
