import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link } from 'react-router'

import { listBuildings, type Building } from '../api/buildings'
import { createFloor, listFloors, type Floor } from '../api/floors'
import { getProjectSnapshot, saveProjectSnapshotSection, type ProjectSnapshot } from '../api/projectData'
import { getUploadPipeline, listUploadsByBuilding, uploadFile, type UploadAsset, type UploadPipeline } from '../api/uploads'
import { usePreferences } from '../app/preferences'
import { preferredBuildingId, useProjectSelectionSync, useProjectStore } from '../stores/projectStore'
import { PageHeader } from './PageHeader'

type SourceType = 'image' | 'dxf' | 'ifc' | 'glb' | 'pointcloud'
type DataSourceIconName = 'building' | 'layers' | 'upload' | 'image' | 'file' | 'box' | 'cloud' | 'check' | 'warning' | 'arrow'

const sourceTypes: Array<{ value: SourceType; icon: DataSourceIconName; accent: string }> = [
  { value: 'image', icon: 'image', accent: 'image' },
  { value: 'dxf', icon: 'file', accent: 'dxf' },
  { value: 'ifc', icon: 'box', accent: 'ifc' },
  { value: 'glb', icon: 'box', accent: 'glb' },
  { value: 'pointcloud', icon: 'cloud', accent: 'pointcloud' },
]

const sourceEmoji: Record<SourceType, string> = {
  image: '🖼️',
  dxf: '📐',
  ifc: '🏢',
  glb: '🧊',
  pointcloud: '☁️',
}

const copy = {
  en: {
    eyebrow: 'Step 2',
    title: 'Data Sources',
    description: 'Connect drawings, BIM models, images, and point clouds to each floor before alignment and editing.',
    workspace: 'Workspace',
    buildingList: 'Building',
    noBuildings: 'Create a project first, then return to connect source data.',
    openProjects: 'Open Projects',
    floorStack: 'Floor Stack',
    noFloors: 'No floors registered yet. Add one below to start uploading data.',
    addFloor: 'Add Floor',
    floorNumber: 'Floor number',
    creating: 'Creating...',
    uploadHub: 'Upload Hub',
    uploadBranches: 'Upload Branches',
    selectBuilding: 'Select a building to begin.',
    selectFloor: 'Select a floor to attach source data.',
    dropTitle: 'Selected upload branch',
    uploadTarget: {
      image: 'Image file upload',
      dxf: 'DXF / DWG file upload',
      ifc: 'IFC file upload',
      glb: 'GLB / GLTF file upload',
      pointcloud: 'PointCloud file upload',
    },
    uploadExample: {
      image: 'Image button -> image file upload',
      dxf: 'DXF / DWG button -> CAD drawing upload',
      ifc: 'IFC button -> BIM model upload',
      glb: 'GLB / GLTF button -> 3D model upload',
      pointcloud: 'PointCloud button -> scan file upload',
    },
    supportedFormatsLabel: 'Supported formats',
    supportedFormats: {
      image: 'PNG, JPG, JPEG',
      dxf: 'DXF, DWG',
      ifc: 'IFC',
      glb: 'GLB, GLTF',
      pointcloud: 'LAS, LAZ, PLY',
    },
    uploadGuideTitle: 'Upload Guide',
    uploadGuides: {
      dxf: [
        'DWG files with XREF references should be bound or converted before upload.',
        'If conversion fails, bind/insert XREF in CAD, save as DXF, then upload again.',
        'Unit scale can be adjusted below. Common values: mm 0.001, cm 0.01, meter 1.0.',
      ],
      glb: [
        'GLB is recommended because geometry, material, and textures are packed into one file.',
        'For GLTF with external .bin or texture files, convert to GLB when possible before uploading.',
        'Use this branch for replacement 3D floor models and later alignment review.',
      ],
    },
    selectedFile: 'Selected File',
    chooseFile: 'Choose File',
    upload: 'Upload Source',
    uploading: 'Uploading...',
    reset: 'Reset',
    uploadComplete: 'Upload complete. The asset list has been refreshed.',
    uploadFailed: 'Upload failed. Check the file and API status, then try again.',
    options: 'Processing Options',
    scale: 'Scale',
    scaleHint: 'Image scale is stored as preparation metadata for floor tracing.',
    unitScale: 'Unit Scale',
    heightOverride: 'Height Override',
    heightPlaceholder: 'Optional meters',
    invertY: 'Invert Y axis after import',
    ifcLevel: 'IFC Floor Level',
    glbMode: 'Model Mode',
    glbModeHint: 'GLB/GLTF files are uploaded as replacement 3D assets for the selected floor.',
    pointCloudHint: 'LAS, LAZ, and PLY files are registered for later alignment and inspection.',
    statusPanel: 'Connection Status',
    pipelineStage: 'Pipeline',
    selectedFloor: 'Selected Floor',
    noSelection: 'No selection',
    connected: 'Connected',
    waiting: 'Waiting',
    latestUploads: 'Latest Uploads',
    noUploads: 'No uploaded files yet.',
    allFloorStatus: 'All Floor Status',
    uploadCount: 'Uploads',
    sourceType: 'Source',
    ready: 'Ready',
    floorSuffix: 'F',
    sourceLabels: {
      image: 'Image',
      dxf: 'DXF / DWG',
      ifc: 'IFC',
      glb: 'GLB / GLTF',
      pointcloud: 'PointCloud',
    },
    sourceDescriptions: {
      image: 'PNG/JPG floor plan image',
      dxf: 'CAD linework and DWG drawing',
      ifc: 'BIM model by floor level',
      glb: '3D scene or replacement model',
      pointcloud: 'LAS/LAZ/PLY scan data',
    },
    sourceActions: {
      image: 'Upload Image',
      dxf: 'Upload DXF/DWG',
      ifc: 'Upload IFC',
      glb: 'Upload GLB/GLTF',
      pointcloud: 'Upload PointCloud',
    },
  },
  ko: {
    eyebrow: 'Step 2',
    title: '데이터 소스',
    description: '정합과 편집 전에 도면, BIM 모델, 이미지, PointCloud를 층별로 연결합니다.',
    workspace: '작업 공간',
    buildingList: '건물',
    noBuildings: '먼저 프로젝트를 생성한 뒤 데이터 소스를 연결하세요.',
    openProjects: '프로젝트 열기',
    floorStack: '층 구성',
    noFloors: '등록된 층이 없습니다. 아래에서 층을 추가하면 업로드를 시작할 수 있습니다.',
    addFloor: '층 추가',
    floorNumber: '층 번호',
    creating: '추가 중...',
    uploadHub: '업로드 허브',
    uploadBranches: '업로드 분기',
    selectBuilding: '건물을 선택하면 데이터 연결을 시작할 수 있습니다.',
    selectFloor: '소스 데이터를 연결할 층을 선택하세요.',
    dropTitle: '선택된 업로드 분기',
    uploadTarget: {
      image: '이미지 파일 업로드',
      dxf: 'DXF / DWG 파일 업로드',
      ifc: 'IFC 파일 업로드',
      glb: 'GLB / GLTF 파일 업로드',
      pointcloud: 'PointCloud 파일 업로드',
    },
    uploadExample: {
      image: '이미지 버튼 -> 이미지 파일 업로드',
      dxf: 'DXF / DWG 버튼 -> CAD 도면 업로드',
      ifc: 'IFC 버튼 -> BIM 모델 업로드',
      glb: 'GLB / GLTF 버튼 -> 3D 모델 업로드',
      pointcloud: 'PointCloud 버튼 -> 스캔 파일 업로드',
    },
    supportedFormatsLabel: '지원 형식',
    supportedFormats: {
      image: 'PNG, JPG, JPEG',
      dxf: 'DXF, DWG',
      ifc: 'IFC',
      glb: 'GLB, GLTF',
      pointcloud: 'LAS, LAZ, PLY',
    },
    uploadGuideTitle: '업로드 안내',
    uploadGuides: {
      dxf: [
        'XREF가 포함된 DWG는 참조 파일을 병합하거나 DXF로 변환한 뒤 업로드하는 것이 안전합니다.',
        '변환 실패 시 CAD에서 XREF를 Bind/Insert 처리한 뒤 DXF로 저장해서 다시 업로드하세요.',
        '아래 단위 스케일에서 mm는 0.001, cm는 0.01, meter는 1.0 값을 사용합니다.',
      ],
      glb: [
        'GLB는 형상, 재질, 텍스처가 하나의 파일에 포함되어 있어 가장 안정적입니다.',
        'GLTF가 외부 .bin 또는 텍스처 파일을 참조한다면 가능하면 GLB로 변환한 뒤 업로드하세요.',
        '이 분기는 선택한 층의 대체 3D 모델과 이후 정합 검토용 모델 등록에 사용됩니다.',
      ],
    },
    selectedFile: '선택 파일',
    chooseFile: '파일 선택',
    upload: '소스 업로드',
    uploading: '업로드 중...',
    reset: '초기화',
    uploadComplete: '업로드가 완료되었습니다. 자산 목록을 새로고침했습니다.',
    uploadFailed: '업로드에 실패했습니다. 파일과 API 상태를 확인한 뒤 다시 시도하세요.',
    options: '처리 옵션',
    scale: '스케일',
    scaleHint: '이미지 스케일은 층 추적을 위한 준비 메타데이터로 저장됩니다.',
    unitScale: '단위 스케일',
    heightOverride: '높이 재정의',
    heightPlaceholder: '선택 입력, meter',
    invertY: '가져온 뒤 Y축 반전',
    ifcLevel: 'IFC 층 레벨',
    glbMode: '모델 모드',
    glbModeHint: 'GLB/GLTF는 선택한 층의 대체 3D 자산으로 업로드됩니다.',
    pointCloudHint: 'LAS, LAZ, PLY 파일은 이후 정합과 검토에 사용할 수 있도록 등록됩니다.',
    statusPanel: '연결 상태',
    pipelineStage: '파이프라인',
    selectedFloor: '선택된 층',
    noSelection: '선택 없음',
    connected: '연결됨',
    waiting: '대기',
    latestUploads: '최근 업로드',
    noUploads: '아직 업로드된 파일이 없습니다.',
    allFloorStatus: '전체 층 상태',
    uploadCount: '업로드',
    sourceType: '소스',
    ready: '준비됨',
    floorSuffix: '층',
    sourceLabels: {
      image: 'Image',
      dxf: 'DXF / DWG',
      ifc: 'IFC',
      glb: 'GLB / GLTF',
      pointcloud: 'PointCloud',
    },
    sourceDescriptions: {
      image: 'PNG/JPG 평면 이미지',
      dxf: 'CAD 선형과 DWG 도면',
      ifc: '층 레벨 기반 BIM 모델',
      glb: '3D 씬 또는 대체 모델',
      pointcloud: 'LAS/LAZ/PLY 스캔 데이터',
    },
    sourceActions: {
      image: 'Image 업로드',
      dxf: 'DXF/DWG 업로드',
      ifc: 'IFC 업로드',
      glb: 'GLB/GLTF 업로드',
      pointcloud: 'PointCloud 업로드',
    },
  },
} as const

function DataSourceIcon({ name }: { name: DataSourceIconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
  } as const

  const icons = {
    building: <path {...common} d="M4 20V7l8-4 8 4v13M8 20v-7h8v7M8 8h.01M12 7h.01M16 8h.01" />,
    layers: <path {...common} d="m12 3 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4" />,
    upload: <path {...common} d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
    image: (
      <>
        <rect {...common} x="4" y="5" width="16" height="14" rx="2" />
        <circle {...common} cx="9" cy="10" r="1.5" />
        <path {...common} d="m5 17 4.5-4 3 3 2-2 4.5 3" />
      </>
    ),
    file: <path {...common} d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h6" />,
    box: <path {...common} d="m12 3 8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10" />,
    cloud: <path {...common} d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.2 1.8A3.2 3.2 0 0 0 7 18Z" />,
    check: <path {...common} d="m5 12 4 4L19 6" />,
    warning: (
      <>
        <path {...common} d="m12 3 9 16H3z" />
        <path {...common} d="M12 8v5M12 17h.01" />
      </>
    ),
    arrow: <path {...common} d="M5 12h14M13 6l6 6-6 6" />,
  } satisfies Record<DataSourceIconName, ReactNode>

  return (
    <svg aria-hidden="true" className="datasource-icon-svg" viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  )
}

function floorLabel(floor: Floor, suffix: string) {
  return floor.floor_name ?? `${floor.floor_number}${suffix}`
}

function uploadAccept(sourceType: SourceType) {
  return {
    image: '.png,.jpg,.jpeg',
    dxf: '.dxf,.dwg',
    ifc: '.ifc',
    glb: '.glb,.gltf',
    pointcloud: '.las,.laz,.ply',
  }[sourceType]
}

function uploadHasFloorData(floor: Floor, uploads: UploadAsset[]) {
  return Boolean(floor.input_type) || uploads.some((upload) => upload.floor_id === floor.id)
}

function formatUploadDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function uploadStatusLabel(status: string, language: 'en' | 'ko') {
  const labels = {
    en: {
      pending: 'Pending',
      uploaded: 'Uploaded',
      validating: 'Validating',
      processing: 'Processing',
      converting: 'Converting',
      preview_ready: 'Preview Ready',
      ready: 'Ready',
      failed: 'Failed',
      queued: 'Queued',
    },
    ko: {
      pending: '대기',
      uploaded: '업로드됨',
      validating: '검증 중',
      processing: '처리 중',
      converting: '변환 중',
      preview_ready: '미리보기 준비',
      ready: '준비 완료',
      failed: '실패',
      queued: '대기열',
    },
  } as const
  const normalized = status in labels.en ? status as keyof typeof labels.en : 'pending'
  return labels[language][normalized]
}

function projectSnapshotLabel(snapshot: ProjectSnapshot | null, language: 'en' | 'ko') {
  if (!snapshot?.saved) return language === 'ko' ? '저장된 스냅샷 없음' : 'No saved snapshot'
  const updatedAt = formatUploadDate(snapshot.updated_at)
  return language === 'ko' ? `최근 저장: ${updatedAt}` : `Last saved: ${updatedAt}`
}

export function DataSourcesPage() {
  const { language } = usePreferences()
  const labels = copy[language]
  const setGlobalSelectedBuildingId = useProjectStore((state) => state.setSelectedBuildingId)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [floors, setFloors] = useState<Floor[]>([])
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null)
  const [uploads, setUploads] = useState<UploadAsset[]>([])
  const [activeTab, setActiveTab] = useState<SourceType>('image')
  const [file, setFile] = useState<File | null>(null)
  const [newFloorNumber, setNewFloorNumber] = useState('')
  const [creatingFloor, setCreatingFloor] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null)
  const [pipelines, setPipelines] = useState<Record<number, UploadPipeline>>({})
  const [scalePxPerMeter, setScalePxPerMeter] = useState(100)
  const [dxfScaleFactor, setDxfScaleFactor] = useState(0.001)
  const [dxfHeight, setDxfHeight] = useState('')
  const [invertYAxis, setInvertYAxis] = useState(false)
  const [floorLevel, setFloorLevel] = useState(0)

  const selectedBuilding = useMemo(
    () => buildings.find((building) => building.id === selectedBuildingId) ?? null,
    [buildings, selectedBuildingId],
  )
  useProjectSelectionSync(buildings, selectedBuildingId, setSelectedBuildingId)
  const selectedFloor = useMemo(() => floors.find((floor) => floor.id === selectedFloorId) ?? null, [floors, selectedFloorId])
  const sortedFloors = useMemo(() => floors.slice().sort((a, b) => b.floor_number - a.floor_number), [floors])
  const connectedFloorCount = useMemo(
    () => floors.filter((floor) => uploadHasFloorData(floor, uploads)).length,
    [floors, uploads],
  )
  const latestUploads = useMemo(() => uploads.slice().reverse().slice(0, 6), [uploads])

  const loadBuildings = useCallback(async () => {
    try {
      const data = await listBuildings()
      setBuildings(data)
      setSelectedBuildingId((current) => {
        const next = preferredBuildingId(data, current)
        setGlobalSelectedBuildingId(next)
        return next
      })
    } catch {
      setBuildings([])
      setSelectedBuildingId(null)
    }
  }, [])

  const loadBuildingData = useCallback(async (buildingId: number) => {
    const [nextFloors, nextUploads, nextSnapshot] = await Promise.all([
      listFloors(buildingId),
      listUploadsByBuilding(buildingId),
      getProjectSnapshot(buildingId).catch(() => null),
    ])
    setFloors(nextFloors)
    setUploads(nextUploads)
    setSnapshot(nextSnapshot)
    const uploadPipelines = await Promise.all(
      nextUploads.slice(-8).map((upload) => getUploadPipeline(upload.id).catch(() => null)),
    )
    setPipelines(Object.fromEntries(uploadPipelines.filter((pipeline): pipeline is UploadPipeline => pipeline !== null).map((pipeline) => [pipeline.upload.id, pipeline])))
    setSelectedFloorId((current) => {
      if (current && nextFloors.some((floor) => floor.id === current)) return current
      return nextFloors[0]?.id ?? null
    })
  }, [])

  useEffect(() => {
    loadBuildings()
  }, [loadBuildings])

  useEffect(() => {
    if (selectedBuildingId === null) {
      setFloors([])
      setUploads([])
      setSnapshot(null)
      setPipelines({})
      setSelectedFloorId(null)
      return
    }
    loadBuildingData(selectedBuildingId).catch(() => {
      setFloors([])
      setUploads([])
      setSnapshot(null)
      setPipelines({})
      setSelectedFloorId(null)
    })
  }, [loadBuildingData, selectedBuildingId])

  const handleBuildingChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    const next = value ? Number(value) : null
    setSelectedBuildingId(next)
    setGlobalSelectedBuildingId(next)
    setStatusMessage(null)
  }

  const clearFileSelection = () => {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSourceButtonClick = (sourceType: SourceType) => {
    setActiveTab(sourceType)
    setStatusMessage(null)
    clearFileSelection()
  }

  const resetUploadState = () => {
    clearFileSelection()
    setStatusMessage(null)
    setScalePxPerMeter(100)
    setDxfScaleFactor(0.001)
    setDxfHeight('')
    setInvertYAxis(false)
    setFloorLevel(0)
  }

  const handleUpload = async (selectedFile: File) => {
    if (selectedBuildingId === null || selectedFloorId === null) return
    setUploading(true)
    setStatusMessage(null)
    try {
      await uploadFile(selectedFile, activeTab, selectedBuildingId, selectedFloorId)
      clearFileSelection()
      await loadBuildingData(selectedBuildingId)
      setStatusMessage(labels.uploadComplete)
    } catch {
      setStatusMessage(labels.uploadFailed)
    } finally {
      setUploading(false)
    }
  }

  const handleSaveSnapshot = async () => {
    if (selectedBuildingId === null) return
    setSavingSnapshot(true)
    setStatusMessage(null)
    try {
      const savedSnapshot = await saveProjectSnapshotSection(selectedBuildingId, 'datasource', {
        selected_floor_id: selectedFloorId,
        active_source_type: activeTab,
        upload_ids: uploads.map((upload) => upload.id),
        options: {
          scale_px_per_meter: scalePxPerMeter,
          dxf_scale_factor: dxfScaleFactor,
          dxf_height: dxfHeight,
          invert_y_axis: invertYAxis,
          ifc_floor_level: floorLevel,
        },
      })
      setSnapshot(savedSnapshot)
      setStatusMessage(language === 'ko' ? '프로젝트 스냅샷이 저장되었습니다.' : 'Project snapshot saved.')
    } catch {
      setStatusMessage(language === 'ko' ? '프로젝트 스냅샷 저장에 실패했습니다.' : 'Project snapshot save failed.')
    } finally {
      setSavingSnapshot(false)
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null
    setFile(nextFile)
    setStatusMessage(null)
    if (nextFile) {
      handleUpload(nextFile)
    }
  }

  const handleAddFloor = async () => {
    if (selectedBuildingId === null || !newFloorNumber.trim()) return
    const floorNumber = Number(newFloorNumber)
    if (!Number.isInteger(floorNumber)) return
    setCreatingFloor(true)
    try {
      const created = await createFloor(selectedBuildingId, {
        floor_number: floorNumber,
        floor_name: `${floorNumber}${labels.floorSuffix}`,
        height_meters: 3.2,
      })
      setNewFloorNumber('')
      await loadBuildingData(selectedBuildingId)
      setSelectedFloorId(created.id)
    } finally {
      setCreatingFloor(false)
    }
  }

  const activeSource = sourceTypes.find((source) => source.value === activeTab)
  const activeGuide = activeTab === 'dxf' || activeTab === 'glb' ? labels.uploadGuides[activeTab] : null

  return (
    <section className="page-grid datasource-command-page">
      <PageHeader eyebrow={labels.eyebrow} title={labels.title} description={labels.description} />

      <div className="datasource-command-layout">
        <aside className="datasource-panel datasource-left-panel">
          <div className="datasource-card-topline" />
          <div className="datasource-panel-header">
            <div>
              <span className="eyebrow-muted">{labels.workspace}</span>
              <h3>{labels.buildingList}</h3>
            </div>
            <span className="datasource-icon-box">
              <DataSourceIcon name="building" />
            </span>
          </div>

          {buildings.length === 0 ? (
            <div className="datasource-empty-state">
              <p>{labels.noBuildings}</p>
              <Link className="btn btn-primary" to="/projects">
                {labels.openProjects}
                <DataSourceIcon name="arrow" />
              </Link>
            </div>
          ) : (
            <select className="select-input" value={selectedBuildingId ?? ''} onChange={handleBuildingChange}>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          )}

          <div className="datasource-section-title">
            <span>{labels.floorStack}</span>
            <strong>{floors.length}</strong>
          </div>

          {selectedBuilding && sortedFloors.length === 0 && <p className="datasource-muted-text">{labels.noFloors}</p>}

          <div className="datasource-floor-list">
            {sortedFloors.map((floor) => {
              const isSelected = floor.id === selectedFloorId
              const isConnected = uploadHasFloorData(floor, uploads)
              return (
                <button
                  key={floor.id}
                  className={`datasource-floor-item ${isSelected ? 'selected' : ''}`}
                  type="button"
                  onClick={() => setSelectedFloorId(floor.id)}
                >
                  <span className="datasource-floor-main">
                    <strong>{floorLabel(floor, labels.floorSuffix)}</strong>
                    <small>#{floor.id} / {floor.height_meters}m</small>
                  </span>
                  <span className={`datasource-status-dot ${isConnected ? 'connected' : ''}`} title={isConnected ? labels.connected : labels.waiting} />
                </button>
              )
            })}
          </div>

          {selectedBuilding && (
            <div className="datasource-add-floor">
              <input
                className="text-input"
                type="number"
                placeholder={labels.floorNumber}
                value={newFloorNumber}
                onChange={(event) => setNewFloorNumber(event.target.value)}
              />
              <button className="btn btn-secondary" type="button" onClick={handleAddFloor} disabled={creatingFloor || !newFloorNumber.trim()}>
                {creatingFloor ? labels.creating : labels.addFloor}
              </button>
            </div>
          )}
        </aside>

        <main className="datasource-panel datasource-upload-panel">
          <div className="datasource-card-topline muted" />
          <div className="datasource-panel-header">
            <div>
              <span className="eyebrow-muted">{labels.uploadBranches}</span>
              <h3>{labels.uploadHub}</h3>
            </div>
            <span className={`project-badge ${selectedFloor ? 'success' : 'neutral'}`}>{selectedFloor ? labels.ready : labels.waiting}</span>
          </div>

          {!selectedBuilding ? (
            <div className="datasource-empty-state tall">
              <p>{labels.selectBuilding}</p>
            </div>
          ) : !selectedFloor ? (
            <div className="datasource-empty-state tall">
              <span className="datasource-icon-box large">
                <DataSourceIcon name="layers" />
              </span>
              <p>{labels.selectFloor}</p>
            </div>
          ) : (
            <>
              <div className="datasource-upload-branch-grid" aria-label={labels.uploadBranches}>
                {sourceTypes.map((source) => (
                  <button
                    key={source.value}
                    className={`datasource-type-card ${source.accent} ${activeTab === source.value ? 'active' : ''}`}
                    type="button"
                    onClick={() => handleSourceButtonClick(source.value)}
                  >
                    <span className="datasource-type-icon">
                      <DataSourceIcon name={source.icon} />
                    </span>
                    <span>
                      <strong>{labels.sourceActions[source.value]}</strong>
                      <small>{labels.sourceDescriptions[source.value]}</small>
                    </span>
                  </button>
                ))}
              </div>

              <input ref={fileInputRef} type="file" accept={uploadAccept(activeTab)} onChange={handleFileChange} hidden />

              {statusMessage && (
                <div className={`datasource-status-bar ${statusMessage === labels.uploadFailed ? 'error' : 'success'}`}>
                  <DataSourceIcon name={statusMessage === labels.uploadFailed ? 'warning' : 'check'} />
                  {statusMessage}
                </div>
              )}

              <div className={`datasource-upload-zone branch-${activeTab}`}>
                <div className="datasource-upload-zone-top">
                  <span className="datasource-upload-emoji" aria-hidden="true">{sourceEmoji[activeTab]}</span>
                  <div>
                    <h3>{labels.uploadTarget[activeTab]}</h3>
                    <p>{labels.uploadExample[activeTab]}</p>
                    <p className="datasource-supported-format">{labels.supportedFormatsLabel} : {labels.supportedFormats[activeTab]}</p>
                  </div>
                </div>

                {activeGuide && (
                  <div className="datasource-upload-guide">
                    <strong>{labels.uploadGuideTitle}</strong>
                    <ul>
                      {activeGuide.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="datasource-upload-button-row">
                  <button className="btn btn-primary datasource-choose-file-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    <DataSourceIcon name={uploading ? 'check' : activeSource?.icon ?? 'upload'} />
                    {uploading ? labels.uploading : labels.chooseFile}
                  </button>
                  <button className="btn btn-secondary datasource-reset-button" type="button" onClick={resetUploadState} disabled={uploading}>
                    {labels.reset}
                  </button>
                </div>

                {file && (
                  <div className="datasource-selected-file">
                    <span>{labels.selectedFile}</span>
                    <strong>{file.name}</strong>
                    <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
                  </div>
                )}
              </div>

              <section className="datasource-options-card">
                <div className="datasource-section-title no-margin">
                  <span>{labels.options}</span>
                  <strong>{labels.sourceLabels[activeTab]}</strong>
                </div>

                {activeTab === 'image' && (
                  <div className="datasource-option-grid">
                    <label className="datasource-option-field">
                      <span>{labels.scale}</span>
                      <input className="text-input" type="number" min={1} value={scalePxPerMeter} onChange={(event) => setScalePxPerMeter(Number(event.target.value) || 100)} />
                      <small>{labels.scaleHint}</small>
                    </label>
                  </div>
                )}

                {activeTab === 'dxf' && (
                  <div className="datasource-option-grid two">
                    <div className="datasource-option-field">
                      <span>{labels.unitScale}</span>
                      <div className="datasource-scale-buttons">
                        {[
                          ['mm', 0.001],
                          ['cm', 0.01],
                          ['m', 1],
                        ].map(([unit, scale]) => (
                          <button
                            key={unit}
                            className={dxfScaleFactor === scale ? 'selected' : ''}
                            type="button"
                            onClick={() => setDxfScaleFactor(Number(scale))}
                          >
                            {unit}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="datasource-option-field">
                      <span>{labels.heightOverride}</span>
                      <input className="text-input" type="number" min={0} step={0.1} placeholder={labels.heightPlaceholder} value={dxfHeight} onChange={(event) => setDxfHeight(event.target.value)} />
                    </label>
                    <label className="datasource-checkbox-field">
                      <input type="checkbox" checked={invertYAxis} onChange={(event) => setInvertYAxis(event.target.checked)} />
                      <span>{labels.invertY}</span>
                    </label>
                  </div>
                )}

                {activeTab === 'ifc' && (
                  <div className="datasource-option-grid">
                    <label className="datasource-option-field">
                      <span>{labels.ifcLevel}</span>
                      <input className="text-input" type="number" value={floorLevel} onChange={(event) => setFloorLevel(Number(event.target.value) || 0)} />
                    </label>
                  </div>
                )}

                {activeTab === 'glb' && (
                  <div className="datasource-info-box">
                    <strong>{labels.glbMode}</strong>
                    <p>{labels.glbModeHint}</p>
                  </div>
                )}

                {activeTab === 'pointcloud' && (
                  <div className="datasource-info-box">
                    <strong>{labels.sourceLabels.pointcloud}</strong>
                    <p>{labels.pointCloudHint}</p>
                  </div>
                )}
              </section>
            </>
          )}
        </main>

        <aside className="datasource-panel datasource-status-panel">
          <div className="datasource-card-topline" />
          <div className="datasource-panel-header">
            <div>
              <span className="eyebrow-muted">{labels.workspace}</span>
              <h3>{labels.statusPanel}</h3>
            </div>
            <span className="datasource-icon-box">
              <DataSourceIcon name="check" />
            </span>
          </div>

          <div className="datasource-summary-grid">
            <div>
              <span>{labels.selectedFloor}</span>
              <strong>{selectedFloor ? floorLabel(selectedFloor, labels.floorSuffix) : labels.noSelection}</strong>
            </div>
            <div>
              <span>{labels.uploadCount}</span>
              <strong>{uploads.length}</strong>
            </div>
            <div>
              <span>{labels.connected}</span>
              <strong>{connectedFloorCount}/{floors.length}</strong>
            </div>
            <div>
              <span>{labels.sourceType}</span>
              <strong>{selectedFloor?.input_type ?? labels.waiting}</strong>
            </div>
          </div>

          <section className="datasource-status-section datasource-snapshot-card">
            <div className="datasource-section-title no-margin">
              <span>{language === 'ko' ? '프로젝트 저장/불러오기' : 'Project Save / Load'}</span>
              <strong>{snapshot?.saved ? 'OK' : '-'}</strong>
            </div>
            <p className="datasource-muted-text">{projectSnapshotLabel(snapshot, language)}</p>
            {snapshot?.saved && (
              <p className="datasource-pipeline-note">
                {language === 'ko'
                  ? '이 건물의 최근 데이터소스 선택 상태를 백엔드에서 불러왔습니다.'
                  : 'The latest data-source workspace state was loaded from the backend.'}
              </p>
            )}
            <button className="btn btn-secondary datasource-save-snapshot-button" type="button" onClick={handleSaveSnapshot} disabled={!selectedBuilding || savingSnapshot}>
              {savingSnapshot ? (language === 'ko' ? '저장 중...' : 'Saving...') : (language === 'ko' ? '현재 상태 저장' : 'Save Current State')}
            </button>
          </section>

          <section className="datasource-status-section">
            <div className="datasource-section-title no-margin">
              <span>{labels.allFloorStatus}</span>
              <strong>{connectedFloorCount}</strong>
            </div>
            <div className="datasource-mini-floor-list">
              {sortedFloors.map((floor) => {
                const isConnected = uploadHasFloorData(floor, uploads)
                return (
                  <span key={floor.id}>
                    <em>{floorLabel(floor, labels.floorSuffix)}</em>
                    <strong className={isConnected ? 'connected' : ''}>{isConnected ? labels.connected : labels.waiting}</strong>
                  </span>
                )
              })}
            </div>
          </section>

          <section className="datasource-status-section">
            <div className="datasource-section-title no-margin">
              <span>{labels.latestUploads}</span>
              <strong>{latestUploads.length}</strong>
            </div>
            {latestUploads.length === 0 ? (
              <p className="datasource-muted-text">{labels.noUploads}</p>
            ) : (
              <div className="datasource-upload-list">
                {latestUploads.map((upload) => {
                  const pipeline = pipelines[upload.id]
                  return (
                    <article key={upload.id} className={`datasource-upload-row status-${upload.status}`}>
                      <div className="datasource-upload-row-main">
                        <strong>{upload.filename}</strong>
                        <span>
                          {labels.sourceLabels[upload.source_type as SourceType] ?? upload.source_type}
                        </span>
                      </div>
                      <span className={`datasource-pipeline-badge ${upload.status}`}>{uploadStatusLabel(upload.status, language)}</span>
                      <small>{formatUploadDate(upload.created_at)}</small>
                      {pipeline && (
                        <p className="datasource-pipeline-note">
                          {pipeline.project_assets.length > 0
                            ? (language === 'ko' ? `연결 자산 ${pipeline.project_assets.length}개` : `${pipeline.project_assets.length} linked asset(s)`)
                            : (language === 'ko' ? '연결 자산 대기 중' : 'Waiting for linked asset')}
                          {' · '}
                          {pipeline.current_stage}
                        </p>
                      )}
                      {pipeline && (
                        <div className="datasource-pipeline-progress" aria-label={`${labels.pipelineStage}: ${pipeline.progress}%`}>
                          <i style={{ width: `${Math.max(4, Math.min(100, pipeline.progress))}%` }} />
                        </div>
                      )}
                      {pipeline?.next_actions[0] && <small className="datasource-next-action">{pipeline.next_actions[0]}</small>}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </aside>
      </div>
    </section>
  )
}
