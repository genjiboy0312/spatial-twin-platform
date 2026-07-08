import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'

import { listBuildings, type Building } from '../api/buildings'
import { listFloors, type Floor } from '../api/floors'
import { listUploadsByBuilding, type UploadAsset } from '../api/uploads'
import { usePreferences } from '../app/preferences'
import { useEditorStore } from '../stores/editorStore'
import { PageHeader } from './PageHeader'

type SourceType = 'image' | 'dxf' | 'ifc' | 'glb'
type ModelIconName = 'building' | 'image' | 'file' | 'box' | 'layers' | 'check' | 'clock' | 'warning' | 'plus' | 'arrow' | 'external'

type SourceConfig = {
  type: SourceType
  icon: ModelIconName
  accent: string
}

type SourceGroup = {
  floors: Floor[]
  uploads: UploadAsset[]
  count: number
  status: 'ready' | 'partial' | 'empty'
}

const sourceConfigs: SourceConfig[] = [
  { type: 'image', icon: 'image', accent: 'sky' },
  { type: 'dxf', icon: 'file', accent: 'violet' },
  { type: 'ifc', icon: 'building', accent: 'amber' },
  { type: 'glb', icon: 'box', accent: 'teal' },
]

const copy = {
  en: {
    eyebrow: 'Models',
    title: 'Model Source Hub',
    description: 'Review source-derived models by building and floor before editing, alignment, validation, and monitoring.',
    selector: 'Building Context',
    selectBuilding: 'Select a building',
    noBuildings: 'No projects yet. Create a project first, then connect source data.',
    loading: 'Loading model sources...',
    allFloors: 'All floors',
    parsedFloors: 'Connected floors',
    uploadAssets: 'Upload assets',
    sourceStatus: 'Source Status',
    floorResults: 'Floor Separation Results',
    pointCloudTitle: 'PointCloud Gateway',
    pointCloudDescription: 'Connect LAS, LAZ, or PLY scan data for later GPS alignment and spatial inspection.',
    pointCloudAction: 'Open PointCloud',
    noFloorsTitle: 'No floors registered',
    noFloorsDescription: 'Add floors or upload floor sources from Data Sources before managing model results.',
    emptyTitle: 'Choose a model context',
    emptyDescription: 'Model management starts from a building. Select or create a project, then upload Image, CAD, IFC, GLB/GLTF, or PointCloud sources.',
    openProjects: 'Open Projects',
    openDataSources: 'Open Data Sources',
    openEditor: 'Open 3D Editor',
    connectSource: 'Connect Source',
    edit: 'Edit',
    add: 'Add',
    ready: 'Parsed',
    processing: 'Processing',
    waiting: 'Waiting',
    noData: 'No data',
    unclassified: 'Unclassified Floors',
    undefined: 'Undefined',
    table: {
      number: 'No.',
      floor: 'Floor',
      source: 'Source',
      file: 'File',
      status: 'Status',
      action: 'Action',
    },
    sourceLabels: {
      image: 'Image',
      dxf: 'DXF / DWG',
      ifc: 'IFC',
      glb: 'GLB / GLTF',
      pointcloud: 'PointCloud',
    },
    sourceTitles: {
      image: 'Drawing Image',
      dxf: 'CAD Linework',
      ifc: 'BIM / IFC Model',
      glb: '3D Replacement Model',
    },
    sourceDescriptions: {
      image: 'PNG/JPG floor-plan images prepared for tracing and geometry extraction.',
      dxf: 'DXF/DWG linework used to generate walls, doors, windows, and rooms.',
      ifc: 'IFC building model separated by floor level for BIM-based review.',
      glb: 'GLB/GLTF replacement scene used as the floor render model.',
    },
    sourceHints: {
      image: 'Upload drawing images from Data Sources.',
      dxf: 'Upload CAD drawings from Data Sources.',
      ifc: 'Upload IFC models from Data Sources.',
      glb: 'Upload GLB/GLTF models from Data Sources.',
    },
    sourceParsed: (count: number, label: string) => `${count} floor/source item connected as ${label}.`,
    parsedTotal: (parsed: number, total: number) => `${parsed}/${total} connected`,
    floorSuffix: 'F',
  },
  ko: {
    eyebrow: '모델 관리',
    title: '모델 소스 허브',
    description: '편집, 정합, 검증, 모니터링으로 넘기기 전에 건물/층별 모델 소스와 결과를 한 화면에서 확인합니다.',
    selector: '건물 컨텍스트',
    selectBuilding: '건물 선택',
    noBuildings: '아직 프로젝트가 없습니다. 먼저 프로젝트를 만든 뒤 소스 데이터를 연결하세요.',
    loading: '모델 소스를 불러오는 중...',
    allFloors: '전체 층',
    parsedFloors: '연결된 층',
    uploadAssets: '업로드 자산',
    sourceStatus: '소스 상태',
    floorResults: '층 분리 결과',
    pointCloudTitle: 'PointCloud 게이트웨이',
    pointCloudDescription: 'LAS, LAZ, PLY 스캔 데이터를 연결해 이후 GPS 정합과 공간 검수에 사용합니다.',
    pointCloudAction: 'PointCloud 열기',
    noFloorsTitle: '등록된 층이 없습니다',
    noFloorsDescription: '모델 결과를 관리하려면 먼저 데이터 소스에서 층을 추가하거나 소스 파일을 업로드하세요.',
    emptyTitle: '모델 컨텍스트를 선택하세요',
    emptyDescription: '모델 관리는 건물 선택에서 시작합니다. 프로젝트를 만들고 Image, CAD, IFC, GLB/GLTF, PointCloud 소스를 연결하세요.',
    openProjects: '프로젝트 열기',
    openDataSources: '데이터 소스 열기',
    openEditor: '3D 편집 열기',
    connectSource: '소스 연결',
    edit: '편집',
    add: '추가',
    ready: '파싱 완료',
    processing: '처리 중',
    waiting: '대기',
    noData: '데이터 없음',
    unclassified: '미분류 층',
    undefined: '미정',
    table: {
      number: '번호',
      floor: '층',
      source: '소스',
      file: '파일',
      status: '상태',
      action: '동작',
    },
    sourceLabels: {
      image: 'Image',
      dxf: 'DXF / DWG',
      ifc: 'IFC',
      glb: 'GLB / GLTF',
      pointcloud: 'PointCloud',
    },
    sourceTitles: {
      image: '도면 이미지',
      dxf: 'CAD 라인워크',
      ifc: 'BIM / IFC 모델',
      glb: '3D 대체 모델',
    },
    sourceDescriptions: {
      image: '트레이싱과 형상 추출을 위해 준비된 PNG/JPG 평면 이미지입니다.',
      dxf: '벽, 문, 창, 공간 생성을 위한 DXF/DWG 기반 CAD 라인워크입니다.',
      ifc: '층 레벨별 BIM 검토에 사용하는 IFC 건물 모델입니다.',
      glb: '해당 층의 렌더 모델로 사용하는 GLB/GLTF 대체 3D 씬입니다.',
    },
    sourceHints: {
      image: '데이터 소스에서 도면 이미지를 업로드하세요.',
      dxf: '데이터 소스에서 CAD 도면을 업로드하세요.',
      ifc: '데이터 소스에서 IFC 모델을 업로드하세요.',
      glb: '데이터 소스에서 GLB/GLTF 모델을 업로드하세요.',
    },
    sourceParsed: (count: number, label: string) => `${label} 소스가 ${count}개 층/항목에 연결되었습니다.`,
    parsedTotal: (parsed: number, total: number) => `${parsed}/${total} 연결됨`,
    floorSuffix: '층',
  },
} as const

function ModelIcon({ name }: { name: ModelIconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
  } as const

  const icons = {
    building: <path {...common} d="M4 20V7l8-4 8 4v13M8 20v-7h8v7M8 8h.01M12 7h.01M16 8h.01" />,
    image: (
      <>
        <rect {...common} x="4" y="5" width="16" height="14" rx="2" />
        <circle {...common} cx="9" cy="10" r="1.5" />
        <path {...common} d="m5 17 4.5-4 3 3 2-2 4.5 3" />
      </>
    ),
    file: <path {...common} d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h6" />,
    box: <path {...common} d="m12 3 8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10" />,
    layers: <path {...common} d="m12 3 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4" />,
    check: <path {...common} d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle {...common} cx="12" cy="12" r="9" />
        <path {...common} d="M12 7v5l3 2" />
      </>
    ),
    warning: (
      <>
        <path {...common} d="m12 3 9 16H3z" />
        <path {...common} d="M12 8v5M12 17h.01" />
      </>
    ),
    plus: <path {...common} d="M5 12h14M12 5v14" />,
    arrow: <path {...common} d="M5 12h14M13 6l6 6-6 6" />,
    external: <path {...common} d="M14 4h6v6M10 14 20 4M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />,
  } satisfies Record<ModelIconName, ReactNode>

  return (
    <svg aria-hidden="true" className="models-icon-svg" viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  )
}

function floorLabel(floor: Floor, suffix: string) {
  return floor.floor_name ?? `${floor.floor_number}${suffix}`
}

function fileNameFromPath(path: string | null | undefined) {
  if (!path) return '-'
  return path.split('/').pop()?.split('\\').pop() ?? path
}

function sourceStatus(floors: Floor[], uploads: UploadAsset[]): SourceGroup['status'] {
  if (floors.length === 0 && uploads.length === 0) return 'empty'
  const hasPendingUpload = uploads.some((upload) => upload.status !== 'completed')
  return hasPendingUpload ? 'partial' : 'ready'
}

function groupModelSources(floors: Floor[], uploads: UploadAsset[]): Record<SourceType, SourceGroup> {
  const groups: Record<SourceType, SourceGroup> = {
    image: { floors: [], uploads: [], count: 0, status: 'empty' },
    dxf: { floors: [], uploads: [], count: 0, status: 'empty' },
    ifc: { floors: [], uploads: [], count: 0, status: 'empty' },
    glb: { floors: [], uploads: [], count: 0, status: 'empty' },
  }

  floors.forEach((floor) => {
    const type = floor.input_type as SourceType | null
    if (type && type in groups) groups[type].floors.push(floor)
  })

  uploads.forEach((upload) => {
    const type = upload.source_type as SourceType
    if (type in groups) groups[type].uploads.push(upload)
  })

  sourceConfigs.forEach(({ type }) => {
    const group = groups[type]
    const floorIds = new Set(group.floors.map((floor) => floor.id))
    group.uploads.forEach((upload) => {
      if (upload.floor_id !== null) floorIds.add(upload.floor_id)
    })
    group.count = Math.max(floorIds.size, group.uploads.length)
    group.status = sourceStatus(group.floors, group.uploads)
  })

  return groups
}

function hasFloorModelSource(floor: Floor, uploads: UploadAsset[]) {
  return Boolean(floor.input_type) || uploads.some((upload) => upload.floor_id === floor.id && upload.source_type !== 'pointcloud')
}

function floorSourceType(floor: Floor, uploads: UploadAsset[]): string | null {
  if (floor.input_type) return floor.input_type
  return uploads.find((upload) => upload.floor_id === floor.id && upload.source_type !== 'pointcloud')?.source_type ?? null
}

function latestFloorUpload(floor: Floor, uploads: UploadAsset[]) {
  return uploads.filter((upload) => upload.floor_id === floor.id).slice(-1)[0] ?? null
}

function SourceCard({
  config,
  group,
  labels,
  onAction,
}: {
  config: SourceConfig
  group: SourceGroup
  labels: (typeof copy)['en'] | (typeof copy)['ko']
  onAction: () => void
}) {
  const hasData = group.count > 0
  const label = labels.sourceLabels[config.type]

  return (
    <article className={`models-source-card ${config.accent} ${hasData ? 'has-data' : ''}`}>
      <div className="models-source-topline" />
      <div className="models-source-card-header">
        <span className="models-source-icon">
          <ModelIcon name={config.icon} />
        </span>
        {hasData && (
          <span className="models-source-count">
            <strong>{group.count}</strong>
            <small>{label}</small>
          </span>
        )}
      </div>
      <div className="models-source-copy">
        <span className="models-chip">{label}</span>
        <strong>{labels.sourceTitles[config.type]}</strong>
        <p>{hasData ? labels.sourceParsed(group.count, label) : labels.sourceHints[config.type]}</p>
      </div>
      <div className="models-source-footer">
        <span className={`models-status-text ${group.status}`}>
          <ModelIcon name={group.status === 'ready' ? 'check' : group.status === 'partial' ? 'clock' : 'warning'} />
          {group.status === 'ready' ? labels.ready : group.status === 'partial' ? labels.processing : labels.noData}
        </span>
        <button className="models-ghost-action" type="button" onClick={onAction}>
          <ModelIcon name={hasData ? 'arrow' : 'plus'} />
          {hasData ? labels.edit : labels.add}
        </button>
      </div>
    </article>
  )
}

export function ModelsPage() {
  const navigate = useNavigate()
  const { language } = usePreferences()
  const labels = copy[language]
  const walls = useEditorStore((state) => state.walls)
  const rooms = useEditorStore((state) => state.rooms)
  const devices = useEditorStore((state) => state.devices)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [floors, setFloors] = useState<Floor[]>([])
  const [uploads, setUploads] = useState<UploadAsset[]>([])
  const [loading, setLoading] = useState(false)

  const selectedBuilding = useMemo(
    () => buildings.find((building) => building.id === selectedBuildingId) ?? null,
    [buildings, selectedBuildingId],
  )
  const sortedFloors = useMemo(() => floors.slice().sort((a, b) => a.floor_number - b.floor_number), [floors])
  const sourceGroups = useMemo(() => groupModelSources(floors, uploads), [floors, uploads])
  const connectedFloors = useMemo(() => floors.filter((floor) => hasFloorModelSource(floor, uploads)).length, [floors, uploads])
  const pointCloudCount = useMemo(() => uploads.filter((upload) => upload.source_type === 'pointcloud').length, [uploads])
  const totalAssets = uploads.length
  const localModelSignal = walls.length + rooms.length + devices.length
  const hasAnySource = connectedFloors > 0 || uploads.some((upload) => upload.source_type !== 'pointcloud') || localModelSignal > 0

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

  const loadBuildingSources = useCallback(async (buildingId: number) => {
    setLoading(true)
    try {
      const [nextFloors, nextUploads] = await Promise.all([listFloors(buildingId), listUploadsByBuilding(buildingId)])
      setFloors(nextFloors)
      setUploads(nextUploads)
    } catch {
      setFloors([])
      setUploads([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBuildings()
  }, [loadBuildings])

  useEffect(() => {
    if (selectedBuildingId === null) {
      setFloors([])
      setUploads([])
      return
    }
    loadBuildingSources(selectedBuildingId)
  }, [loadBuildingSources, selectedBuildingId])

  return (
    <section className="page-grid models-page">
      <PageHeader eyebrow={labels.eyebrow} title={labels.title} description={labels.description} />

      <section className="models-context-card">
        <div className="models-context-left">
          <span className="models-large-icon">
            <ModelIcon name="building" />
          </span>
          <div>
            <span className="eyebrow-muted">{labels.selector}</span>
            {buildings.length === 0 ? (
              <p className="models-muted-copy">{labels.noBuildings}</p>
            ) : (
              <select
                className="select-input models-building-select"
                value={selectedBuildingId ?? ''}
                onChange={(event) => setSelectedBuildingId(event.target.value ? Number(event.target.value) : null)}
                aria-label={labels.selectBuilding}
              >
                <option value="" disabled>
                  {labels.selectBuilding}
                </option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="models-context-stats">
          <span>
            <strong>{floors.length}</strong>
            {labels.allFloors}
          </span>
          <span>
            <strong>{connectedFloors}</strong>
            {labels.parsedFloors}
          </span>
          <span>
            <strong>{totalAssets}</strong>
            {labels.uploadAssets}
          </span>
        </div>
      </section>

      {!selectedBuilding && (
        <section className="models-empty-state">
          <span className="models-large-icon">
            <ModelIcon name="layers" />
          </span>
          <strong>{labels.emptyTitle}</strong>
          <p>{labels.emptyDescription}</p>
          <div className="models-empty-actions">
            <Link className="btn btn-primary" to="/projects">{labels.openProjects}</Link>
            <Link className="btn btn-secondary" to="/data-sources">{labels.openDataSources}</Link>
          </div>
        </section>
      )}

      {selectedBuilding && loading && (
        <section className="models-empty-state compact">
          <div className="models-loading-spinner" />
          <p>{labels.loading}</p>
        </section>
      )}

      {selectedBuilding && !loading && (
        <>
          <section className="models-section-header">
            <h2>{labels.sourceStatus}</h2>
            <span>{selectedBuilding.name}</span>
          </section>

          <div className="models-source-grid">
            {sourceConfigs.map((config) => (
              <SourceCard
                key={config.type}
                config={config}
                group={sourceGroups[config.type]}
                labels={labels}
                onAction={() => navigate('/data-sources')}
              />
            ))}
          </div>

          <section className="models-pointcloud-card" onClick={() => navigate('/point-cloud')}>
            <span className="models-large-icon teal">
              <ModelIcon name="layers" />
            </span>
            <div>
              <span className="models-chip">{labels.sourceLabels.pointcloud}</span>
              <strong>{labels.pointCloudTitle}</strong>
              <p>{labels.pointCloudDescription}</p>
            </div>
            <button className="btn btn-primary" type="button">
              {labels.pointCloudAction}
              <ModelIcon name="arrow" />
            </button>
            {pointCloudCount > 0 && <em>{pointCloudCount}</em>}
          </section>

          {floors.length === 0 ? (
            <section className="models-empty-state compact">
              <span className="models-large-icon">
                <ModelIcon name="layers" />
              </span>
              <strong>{labels.noFloorsTitle}</strong>
              <p>{labels.noFloorsDescription}</p>
              <Link className="btn btn-primary" to="/data-sources">{labels.openDataSources}</Link>
            </section>
          ) : (
            <section className="models-floor-panel">
              <div className="models-section-header inside">
                <h2>{labels.floorResults}</h2>
                <span>{labels.parsedTotal(connectedFloors, floors.length)}</span>
              </div>

              <div className="models-floor-table">
                <div className="models-floor-row head">
                  <span>{labels.table.number}</span>
                  <span>{labels.table.floor}</span>
                  <span>{labels.table.source}</span>
                  <span>{labels.table.file}</span>
                  <span>{labels.table.status}</span>
                  <span>{labels.table.action}</span>
                </div>

                {sortedFloors.map((floor) => {
                  const sourceType = floorSourceType(floor, uploads)
                  const upload = latestFloorUpload(floor, uploads)
                  const isConnected = hasFloorModelSource(floor, uploads)
                  const label = sourceType && sourceType in labels.sourceLabels
                    ? labels.sourceLabels[sourceType as keyof typeof labels.sourceLabels]
                    : labels.undefined

                  return (
                    <div key={floor.id} className="models-floor-row">
                      <span className="mono">{floor.floor_number}</span>
                      <span>
                        <strong>{floorLabel(floor, labels.floorSuffix)}</strong>
                        <small>#{floor.id} / {floor.height_meters}m</small>
                      </span>
                      <span>
                        <i className={isConnected ? 'ready' : ''}>{label}</i>
                      </span>
                      <span title={upload?.filename ?? undefined}>{fileNameFromPath(upload?.filename)}</span>
                      <span className={`models-row-status ${isConnected ? 'ready' : 'waiting'}`}>
                        <ModelIcon name={isConnected ? 'check' : 'clock'} />
                        {isConnected ? labels.ready : labels.waiting}
                      </span>
                      <span className="models-row-actions">
                        <button className="models-ghost-action" type="button" onClick={() => navigate(isConnected ? '/editor' : '/data-sources')}>
                          <ModelIcon name={isConnected ? 'external' : 'plus'} />
                          {isConnected ? labels.edit : labels.connectSource}
                        </button>
                      </span>
                    </div>
                  )
                })}
              </div>

              {hasAnySource && (
                <div className="models-editor-cta">
                  <button className="btn btn-primary" type="button" onClick={() => navigate('/editor')}>
                    <ModelIcon name="layers" />
                    {labels.openEditor}
                    <ModelIcon name="arrow" />
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </section>
  )
}
