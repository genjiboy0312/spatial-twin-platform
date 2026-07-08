import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Link } from 'react-router'

import { listBuildings, type Building } from '../api/buildings'
import { listFloors, type Floor } from '../api/floors'
import { listUploadsByBuilding, uploadFile, type UploadAsset } from '../api/uploads'
import { usePreferences } from '../app/preferences'
import { PageHeader } from './PageHeader'

type PointCloudStatus = 'uploaded' | 'ready' | 'converting' | 'failed'
type PointCloudIconName =
  | 'building'
  | 'floor'
  | 'cloud'
  | 'database'
  | 'drive'
  | 'check'
  | 'warning'
  | 'clock'
  | 'upload'
  | 'editor'
  | 'arrow'

const copy = {
  en: {
    eyebrow: 'Models > PointCloud',
    title: 'PointCloud',
    description: 'Connect LAS, LAZ, and PLY scan sources to a building, review file status, and move into editor alignment.',
    building: 'Building',
    floor: 'Floor',
    selectBuilding: 'Select building',
    selectFloor: 'Building level',
    floorHint: 'PointCloud files can be linked to a selected floor or stored at building level.',
    noBuildingTitle: 'No building selected',
    noBuildingDescription: 'Create or select a project before connecting PointCloud data.',
    openProjects: 'Open Projects',
    connectedFiles: 'Connected Files',
    totalPoints: 'Estimated Points',
    readyFiles: 'Ready',
    processing: 'Processing / Failed',
    workflow: 'Workflow Guide',
    workflowSteps: ['Select Building', 'Upload File', 'Edit in Editor'],
    uploadTab: 'Upload',
    connectedTab: 'Connected',
    uploadTitle: 'Drop LAS/LAZ/PLY file or click to upload',
    uploadDescription: 'Supported formats: .las, .laz, .ply',
    uploading: 'Uploading...',
    uploadComplete: 'PointCloud uploaded. Connected list has been refreshed.',
    uploadFailed: 'PointCloud upload failed. Check the file and API status.',
    loading: 'Loading connected PointCloud files...',
    emptyTitle: 'No PointCloud files connected',
    emptyDescription: 'Upload scan data to unlock editor alignment and model review.',
    uploadFromEmpty: 'Upload PointCloud',
    nextTitle: 'Next Step',
    editorTitle: 'Open 3D Editor',
    editorDescription: 'Use connected scan files as alignment references in the editor scene.',
    uploadFirst: 'Upload at least one PointCloud file first.',
    storedAt: 'Stored',
    linkedFloor: 'Linked floor',
    buildingLevel: 'Building level',
    status: {
      uploaded: 'Uploaded',
      ready: 'Ready',
      converting: 'Converting',
      failed: 'Failed',
    },
  },
  ko: {
    eyebrow: '모델 > PointCloud',
    title: 'PointCloud',
    description: 'LAS, LAZ, PLY 스캔 소스를 건물에 연결하고 파일 상태를 검토한 뒤 편집 정합으로 넘깁니다.',
    building: '건물',
    floor: '층',
    selectBuilding: '건물 선택',
    selectFloor: '건물 단위',
    floorHint: 'PointCloud 파일은 선택한 층에 연결하거나 건물 단위로 보관할 수 있습니다.',
    noBuildingTitle: '선택된 건물이 없습니다',
    noBuildingDescription: 'PointCloud 데이터를 연결하기 전에 프로젝트를 생성하거나 선택하세요.',
    openProjects: '프로젝트 열기',
    connectedFiles: '연결 파일',
    totalPoints: '예상 포인트',
    readyFiles: '준비 완료',
    processing: '처리 / 실패',
    workflow: '워크플로 가이드',
    workflowSteps: ['건물 선택', '파일 업로드', 'Editor에서 편집'],
    uploadTab: '업로드',
    connectedTab: '연결됨',
    uploadTitle: 'LAS/LAZ/PLY 파일을 드롭하거나 클릭해서 업로드',
    uploadDescription: '지원 형식: .las, .laz, .ply',
    uploading: '업로드 중...',
    uploadComplete: 'PointCloud 업로드가 완료되었습니다. 연결 목록을 새로고침했습니다.',
    uploadFailed: 'PointCloud 업로드에 실패했습니다. 파일과 API 상태를 확인하세요.',
    loading: '연결된 PointCloud 파일을 불러오는 중...',
    emptyTitle: '연결된 PointCloud 파일이 없습니다',
    emptyDescription: '스캔 데이터를 업로드하면 편집 정합과 모델 검토에 사용할 수 있습니다.',
    uploadFromEmpty: 'PointCloud 업로드',
    nextTitle: '다음 단계',
    editorTitle: '3D Editor 열기',
    editorDescription: '연결된 스캔 파일을 편집 씬의 정합 기준으로 사용합니다.',
    uploadFirst: '먼저 PointCloud 파일을 하나 이상 업로드하세요.',
    storedAt: '저장 위치',
    linkedFloor: '연결 층',
    buildingLevel: '건물 단위',
    status: {
      uploaded: '업로드됨',
      ready: '준비 완료',
      converting: '변환 중',
      failed: '실패',
    },
  },
} as const

function PointCloudIcon({ name }: { name: PointCloudIconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
  } as const

  const icons = {
    building: <path {...common} d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 8h.01M12 8h.01M15 8h.01M9 12h.01M12 12h.01M15 12h.01M8 21v-5h8v5" />,
    floor: <path {...common} d="M4 7h16M4 12h16M4 17h16M7 4v16M17 4v16" />,
    cloud: <path {...common} d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.2 1.8A3.2 3.2 0 0 0 7 18Z" />,
    database: (
      <>
        <ellipse {...common} cx="12" cy="6" rx="7" ry="3" />
        <path {...common} d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
      </>
    ),
    drive: <path {...common} d="M5 6h14l2 8v4H3v-4zM7 14h10M17 18h.01" />,
    check: <path {...common} d="m5 12 4 4L19 6" />,
    warning: (
      <>
        <path {...common} d="m12 3 9 16H3z" />
        <path {...common} d="M12 8v5M12 17h.01" />
      </>
    ),
    clock: <path {...common} d="M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    upload: <path {...common} d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
    editor: <path {...common} d="M5 19h4l10-10a2.1 2.1 0 0 0-3-3L6 16zM13.5 6.5l4 4" />,
    arrow: <path {...common} d="M5 12h14M13 6l6 6-6 6" />,
  } satisfies Record<PointCloudIconName, ReactNode>

  return (
    <svg aria-hidden="true" className="pointcloud-icon-svg" viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  )
}

function uploadStatus(asset: UploadAsset): PointCloudStatus {
  if (asset.status === 'ready' || asset.status === 'converting' || asset.status === 'failed') return asset.status
  return 'uploaded'
}

function estimatePoints(asset: UploadAsset) {
  const seed = asset.filename.length + asset.id * 17
  return Math.max(10_000, seed * 125_000)
}

function formatPoints(points: number): string {
  if (points >= 1_000_000) return `${(points / 1_000_000).toFixed(1)}M`
  if (points >= 1_000) return `${(points / 1_000).toFixed(1)}K`
  return String(points)
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function floorLabel(floor: Floor) {
  return floor.floor_name ?? `${floor.floor_number}F`
}

export function PointCloudPage() {
  const { language } = usePreferences()
  const labels = copy[language]
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [floors, setFloors] = useState<Floor[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null)
  const [uploads, setUploads] = useState<UploadAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [activeTab, setActiveTab] = useState<'upload' | 'connected'>('upload')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pointClouds = useMemo(() => uploads.filter((upload) => upload.source_type === 'pointcloud'), [uploads])

  const stats = useMemo(() => {
    const totalPoints = pointClouds.reduce((sum, asset) => sum + estimatePoints(asset), 0)
    const readyCount = pointClouds.filter((asset) => uploadStatus(asset) === 'ready' || uploadStatus(asset) === 'uploaded').length
    const processingCount = pointClouds.filter((asset) => ['converting', 'failed'].includes(uploadStatus(asset))).length
    return { totalFiles: pointClouds.length, totalPoints, readyCount, processingCount }
  }, [pointClouds])

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

  const refreshBuildingData = useCallback(async (buildingId: number) => {
    setLoading(true)
    try {
      const [nextFloors, nextUploads] = await Promise.all([listFloors(buildingId), listUploadsByBuilding(buildingId)])
      setFloors(nextFloors)
      setUploads(nextUploads)
      setSelectedFloorId((current) => {
        if (current && nextFloors.some((floor) => floor.id === current)) return current
        return nextFloors[0]?.id ?? null
      })
    } catch {
      setFloors([])
      setUploads([])
      setSelectedFloorId(null)
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
      setSelectedFloorId(null)
      return
    }
    refreshBuildingData(selectedBuildingId)
  }, [refreshBuildingData, selectedBuildingId])

  const handleUpload = useCallback(async (file: File) => {
    if (selectedBuildingId === null) {
      setError(labels.noBuildingTitle)
      return
    }

    const lowerName = file.name.toLowerCase()
    if (!['.las', '.laz', '.ply'].some((extension) => lowerName.endsWith(extension))) {
      setError(labels.uploadDescription)
      return
    }

    setUploading(true)
    setError(null)
    setMessage(null)
    try {
      await uploadFile(file, 'pointcloud', selectedBuildingId, selectedFloorId ?? undefined)
      await refreshBuildingData(selectedBuildingId)
      setMessage(labels.uploadComplete)
      setActiveTab('connected')
    } catch {
      setError(labels.uploadFailed)
    } finally {
      setUploading(false)
    }
  }, [labels.noBuildingTitle, labels.uploadComplete, labels.uploadDescription, labels.uploadFailed, refreshBuildingData, selectedBuildingId, selectedFloorId])

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }

  return (
    <section className="page-grid pointcloud-page">
      <PageHeader eyebrow={labels.eyebrow} title={labels.title} description={labels.description} />

      {buildings.length === 0 ? (
        <div className="pointcloud-empty-project">
          <span className="pointcloud-large-icon">
            <PointCloudIcon name="building" />
          </span>
          <h2>{labels.noBuildingTitle}</h2>
          <p>{labels.noBuildingDescription}</p>
          <Link className="btn btn-primary" to="/projects">{labels.openProjects}</Link>
        </div>
      ) : (
        <>
          <section className="pointcloud-building-bar">
            <span className="pointcloud-icon-box"><PointCloudIcon name="building" /></span>
            <label>
              <span>{labels.building}</span>
              <select className="select-input" value={selectedBuildingId ?? ''} onChange={(event) => setSelectedBuildingId(event.target.value ? Number(event.target.value) : null)}>
                <option value="">{labels.selectBuilding}</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>{building.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{labels.floor}</span>
              <select className="select-input" value={selectedFloorId ?? ''} onChange={(event) => setSelectedFloorId(event.target.value ? Number(event.target.value) : null)}>
                <option value="">{labels.selectFloor}</option>
                {floors.map((floor) => (
                  <option key={floor.id} value={floor.id}>{floorLabel(floor)}</option>
                ))}
              </select>
            </label>
            <div className="pointcloud-building-stats">
              <strong>{stats.totalFiles}</strong>
              <span>{labels.connectedFiles}</span>
            </div>
            <div className="pointcloud-building-stats">
              <strong>{stats.readyCount}</strong>
              <span>{labels.readyFiles}</span>
            </div>
          </section>

          <p className="pointcloud-floor-note"><PointCloudIcon name="floor" /> {labels.floorHint}</p>

          <div className="pointcloud-stat-grid">
            <article className="pointcloud-stat-card teal">
              <PointCloudIcon name="cloud" />
              <span>{labels.connectedFiles}</span>
              <strong>{stats.totalFiles}</strong>
            </article>
            <article className="pointcloud-stat-card blue">
              <PointCloudIcon name="database" />
              <span>{labels.totalPoints}</span>
              <strong>{formatPoints(stats.totalPoints)}</strong>
            </article>
            <article className="pointcloud-stat-card green">
              <PointCloudIcon name="check" />
              <span>{labels.readyFiles}</span>
              <strong>{stats.readyCount}</strong>
            </article>
            <article className="pointcloud-stat-card amber">
              <PointCloudIcon name="drive" />
              <span>{labels.processing}</span>
              <strong>{stats.processingCount}</strong>
            </article>
          </div>

          <section className="pointcloud-workflow-strip">
            <strong><PointCloudIcon name="clock" /> {labels.workflow}</strong>
            {labels.workflowSteps.map((step, index) => {
              const complete = index === 0 ? selectedBuildingId !== null : index === 1 ? pointClouds.length > 0 : false
              return (
                <span key={step} className={complete ? 'complete' : ''}>
                  {complete ? <PointCloudIcon name="check" /> : <i />}
                  {step}
                </span>
              )
            })}
          </section>

          <main className="pointcloud-main-panel">
            <div className="pointcloud-tabbar">
              <button className={activeTab === 'upload' ? 'active' : ''} type="button" onClick={() => setActiveTab('upload')}>
                <PointCloudIcon name="upload" />
                {labels.uploadTab}
              </button>
              <button className={activeTab === 'connected' ? 'active' : ''} type="button" onClick={() => setActiveTab('connected')}>
                <PointCloudIcon name="database" />
                {labels.connectedTab}
                <small>{pointClouds.length}</small>
              </button>
            </div>

            <div className="pointcloud-panel-body">
              {activeTab === 'upload' ? (
                <>
                  <div
                    className={`pointcloud-dropzone ${isDragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => !uploading && inputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setIsDragging(true)
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
                    }}
                  >
                    <span className="pointcloud-large-icon">
                      <PointCloudIcon name={uploading ? 'clock' : 'upload'} />
                    </span>
                    <strong>{uploading ? labels.uploading : labels.uploadTitle}</strong>
                    <p>{labels.uploadDescription}</p>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".las,.laz,.ply"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) handleUpload(file)
                      event.currentTarget.value = ''
                    }}
                  />
                </>
              ) : (
                <>
                  {loading && <p className="pointcloud-muted">{labels.loading}</p>}
                  {!loading && pointClouds.length === 0 && (
                    <div className="pointcloud-empty-list">
                      <span className="pointcloud-large-icon"><PointCloudIcon name="cloud" /></span>
                      <strong>{labels.emptyTitle}</strong>
                      <p>{labels.emptyDescription}</p>
                      <button className="btn btn-secondary" type="button" onClick={() => setActiveTab('upload')}>{labels.uploadFromEmpty}</button>
                    </div>
                  )}
                  {pointClouds.length > 0 && (
                    <div className="pointcloud-source-list">
                      {pointClouds.map((asset) => {
                        const status = uploadStatus(asset)
                        const floor = floors.find((candidate) => candidate.id === asset.floor_id)
                        return (
                          <article key={asset.id} className={`pointcloud-source-card ${status}`}>
                            <span className="pointcloud-source-status"><PointCloudIcon name={status === 'failed' ? 'warning' : status === 'converting' ? 'clock' : 'check'} /></span>
                            <div>
                              <div className="pointcloud-source-title">
                                <strong>{asset.filename}</strong>
                                <em>{labels.status[status]}</em>
                              </div>
                              <p>
                                {formatPoints(estimatePoints(asset))} / {formatDate(asset.created_at)}
                              </p>
                              <p>
                                {labels.storedAt}: {asset.floor_id ? `${labels.linkedFloor} ${floor ? floorLabel(floor) : `#${asset.floor_id}`}` : labels.buildingLevel}
                              </p>
                              {asset.message && <p className="pointcloud-upload-message">{asset.message}</p>}
                              {status === 'converting' && (
                                <div className="pointcloud-progress-track"><i style={{ width: '48%' }} /></div>
                              )}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {message && <div className="pointcloud-message success"><PointCloudIcon name="check" /> {message}</div>}
              {error && <div className="pointcloud-message error"><PointCloudIcon name="warning" /> {error}</div>}
            </div>
          </main>

          <section className="pointcloud-next-card pointcloud-next-card-wide">
            <span className="eyebrow-muted">{labels.nextTitle}</span>
            <Link className={`pointcloud-next-link ${pointClouds.length === 0 ? 'disabled' : ''}`} to={pointClouds.length === 0 ? '#' : '/editor'} aria-disabled={pointClouds.length === 0}>
              <span><PointCloudIcon name="editor" /></span>
              <div>
                <strong>{labels.editorTitle}</strong>
                <p>{pointClouds.length === 0 ? labels.uploadFirst : labels.editorDescription}</p>
              </div>
              <PointCloudIcon name="arrow" />
            </Link>
          </section>
        </>
      )}
    </section>
  )
}
