import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Upload, Download } from '../components/Icons'
import { ViewToolbar } from '../components/ViewToolbar'
import { ViewModeBar } from '../components/ViewModeBar'
import { ObjectSnapPanel } from '../components/ObjectSnapPanel'

import { listBuildings, type Building } from '../api/buildings'
import { createFloor, listFloors, type Floor } from '../api/floors'
import { usePreferences } from '../app/preferences'
import { Canvas2DViewer, type Wall2D } from '../components/Canvas2DViewer'
import { PropertyPanel } from '../components/PropertyPanel'
import { DrawingToolbar } from '../components/DrawingToolbar'
import { EnhancedLayerPanel } from '../components/layer/EnhancedLayerPanel'
import { EnhancedDevicePanel } from '../components/device/EnhancedDevicePanel'
import {
  useEditorStore,
  type EditMode,
  type SecurityDevice,
  type SecurityDeviceType,
} from '../stores/editorStore'
import { PageHeader } from './PageHeader'
import { UploadModal } from '../components/UploadModal'
import { ExportModal } from '../components/ExportModal'
import { FloorPositionModal } from '../components/FloorPositionModal'

import { SnapType, type SnapConfig } from '../utils/objectSnap'
import { listUploadsByBuilding, type UploadAsset } from '../api/uploads'
import {
  createObjectPlacement,
  deleteObjectPlacement,
  getProjectSnapshot,
  listObjectPlacements,
  saveProjectSnapshot,
  type ObjectPlacement,
} from '../api/projectData'
const ThreeJSViewer = lazy(() =>
  import('../components/ThreeJSViewer').then((module) => ({ default: module.ThreeJSViewer })),
)

const copy = {
  en: {
    eyebrow: '3D Editor',
    title: 'Spatial Editor Scene',
    description: 'Edit the twin in a dedicated scene with floor navigation, view modes, canvas overlays, and properties.',
    building: 'Building',
    noBuilding: 'No building selected',
    floorStack: 'Floor Stack',
    addFloor: 'Add Floor',
    upload: 'Upload Source',
    canvas: 'Canvas',
    scene: 'Scene',
    properties: 'Properties',
    settings: 'Settings',
    deviceSize: 'Device Size',
    snap: 'Object Snap',
    layers: 'Layers',
    autosaved: 'Autosaved just now',
    selectBuilding: '-- Select building --',
    noFloors: 'No floors yet. Add one or continue with the sample scene.',
    loading3d: 'Loading 3D viewer...',
    floorSuffix: 'F',
    modes: { '2d': '2D', split: 'Split', '3d': '3D', pointcloud: 'PointCloud', ifc: 'IFC' },
    sample: 'Sample',
    clear: 'Clear',
  },
  ko: {
    eyebrow: 'STEP 3',
    title: '공간 편집',
    description: '층 탐색, 캔버스 오버레이, 뷰 모드, 속성 패널을 한 화면에서 다루는 전용 편집 씬입니다.',
    building: '건물',
    noBuilding: '선택된 건물 없음',
    floorStack: '층 구성',
    addFloor: '층 추가',
    upload: '소스 업로드',
    canvas: '캔버스',
    scene: '씬',
    properties: '속성',
    settings: '설정',
    deviceSize: '장치 크기',
    snap: '오브젝트 스냅',
    layers: '레이어',
    autosaved: '방금 자동 저장됨',
    selectBuilding: '-- 건물 선택 --',
    noFloors: '아직 층이 없습니다. 층을 추가하거나 샘플 씬으로 계속 진행하세요.',
    loading3d: '3D 뷰어 로딩 중...',
    floorSuffix: '층',
    modes: { '2d': '2D', split: '분할', '3d': '3D', pointcloud: 'PointCloud', ifc: 'IFC' },
    sample: '샘플',
    clear: '지우기',
  },
} as const

type ViewMode = '2d' | 'split' | '3d' | 'pointcloud' | 'ifc'
type EditorSaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

const viewModes: ViewMode[] = ['2d', '3d', 'split', 'pointcloud', 'ifc']
const POINTCLOUD_MAX_POINTS = 2_000_000

function floorLabel(floor: Floor, suffix: string) {
  return floor.floor_name ?? `${floor.floor_number}${suffix}`
}

function formatPointCount(value: number) {
  return new Intl.NumberFormat('ko-KR').format(value)
}

function isEditorSnapshot(value: unknown): value is {
  walls?: Wall2D[]
  rooms?: Array<{ x: number; y: number; w: number; h: number; label?: string }>
  devices?: SecurityDevice[]
  visibleLayers?: { walls: boolean; rooms: boolean; devices: boolean }
  snapMode?: 'grid' | 'endpoint' | 'both' | 'none'
  viewMode?: ViewMode
  selectedFloorId?: number | ''
} {
  return typeof value === 'object' && value !== null
}

function placementFromDevice(device: SecurityDevice, floorId: number | '') {
  return {
    object_type: 'security_device',
    name: device.name || device.device_type,
    floor_id: floorId === '' ? null : floorId,
    position_x: device.x,
    position_y: 0,
    position_z: device.y,
    rotation_y: device.angle ?? 0,
    status: 'active',
    metadata: {
      editor_source: 'editor-device',
      editor_id: device.id,
      device_type: device.device_type,
    },
  }
}

function deviceFromPlacement(placement: ObjectPlacement): SecurityDevice | null {
  const metadata = placement.metadata ?? {}
  if (metadata.editor_source !== 'editor-device') return null
  const deviceType = metadata.device_type
  if (deviceType !== 'camera' && deviceType !== 'sensor' && deviceType !== 'alarm' && deviceType !== 'access') return null
  return {
    id: typeof metadata.editor_id === 'string' ? metadata.editor_id : `placement-${placement.id}`,
    name: placement.name,
    device_type: deviceType,
    x: placement.position_x,
    y: placement.position_z,
    angle: placement.rotation_y,
  }
}

function editorSaveLabel(status: EditorSaveStatus, language: 'en' | 'ko') {
  const labels = {
    en: {
      idle: 'Project sync ready',
      loading: 'Loading project state...',
      saving: 'Saving project state...',
      saved: 'Autosaved just now',
      error: 'Autosave failed',
    },
    ko: {
      idle: '프로젝트 동기화 준비',
      loading: '프로젝트 상태 불러오는 중...',
      saving: '프로젝트 상태 저장 중...',
      saved: '방금 자동 저장됨',
      error: '자동 저장 실패',
    },
  } as const
  return labels[language][status]
}

function PointCloudGenerationMeter({ uploads }: { uploads: UploadAsset[] }) {
  const [generatedPoints, setGeneratedPoints] = useState(0)
  const totalPoints = uploads.length > 0 ? POINTCLOUD_MAX_POINTS : 0

  useEffect(() => {
    if (uploads.length === 0) {
      setGeneratedPoints(0)
      return undefined
    }

    let frameId = 0
    let generated = 0

    const drawBatch = () => {
      generated = Math.min(totalPoints, generated + Math.max(8_000, Math.floor(totalPoints * 0.025)))
      setGeneratedPoints(generated)
      if (generated < totalPoints) frameId = window.requestAnimationFrame(drawBatch)
    }

    setGeneratedPoints(0)
    frameId = window.requestAnimationFrame(drawBatch)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [totalPoints, uploads])

  return (
    <div className="editor-pointcloud-generation-meter">
      <strong>{formatPointCount(generatedPoints)}</strong>
      <span>/ {formatPointCount(totalPoints)} points generated</span>
    </div>
  )
}

export function EditorPage() {
  const { language } = usePreferences()
  const navigate = useNavigate()
  const labels = copy[language]
  const [buildings, setBuildings] = useState<Building[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | ''>('')
  const [floors, setFloors] = useState<Floor[]>([])
  const [selectedFloorId, setSelectedFloorId] = useState<number | ''>('')
  const [allFloorsView, setAllFloorsView] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [initialized, setInitialized] = useState(false)
  const [deviceType, setDeviceType] = useState<SecurityDeviceType>('camera')
  const [deviceScale, setDeviceScale] = useState(5)
  const [fitViewTrigger, setFitViewTrigger] = useState(0)
  const [pointCloudUploads, setPointCloudUploads] = useState<UploadAsset[]>([])
  const [editorHydrated, setEditorHydrated] = useState(false)
  const [saveStatus, setSaveStatus] = useState<EditorSaveStatus>('idle')
  const autosaveTimerRef = useRef<number | null>(null)
  const [snapConfig, setSnapConfig] = useState<SnapConfig>({
    enabled: true,
    types: [SnapType.ENDPOINT, SnapType.MIDPOINT, SnapType.GRID],
    gridSize: 1,
    tolerance: 10,
    endpointThreshold: 0.5,
  })

  const mode = useEditorStore((state) => state.mode)
  const walls = useEditorStore((state) => state.walls)
  const rooms = useEditorStore((state) => state.rooms)
  const devices = useEditorStore((state) => state.devices)
  const selectedWallIdx = useEditorStore((state) => state.selectedWallIdx)
  const selectedRoomIdx = useEditorStore((state) => state.selectedRoomIdx)
  const selectedDeviceIdx = useEditorStore((state) => state.selectedDeviceIdx)
  const visibleLayers = useEditorStore((state) => state.visibleLayers)
  const snapMode = useEditorStore((state) => state.snapMode)
  const setMode = useEditorStore((state) => state.setMode)
  const addWall = useEditorStore((state) => state.addWall)
  const addRoom = useEditorStore((state) => state.addRoom)
  const selectWall = useEditorStore((state) => state.selectWall)
  const selectRoom = useEditorStore((state) => state.selectRoom)
  const selectDevice = useEditorStore((state) => state.selectDevice)
  const deleteWallAt = useEditorStore((state) => state.deleteWallAt)
  const removeDevice = useEditorStore((state) => state.removeDevice)
  const loadSample = useEditorStore((state) => state.loadSample)
  const clearAll = useEditorStore((state) => state.clearAll)
  const moveWall = useEditorStore((state) => state.moveWall)
  const pushHistory = useEditorStore((state) => state.pushHistory)
  const snapPoint = useEditorStore((state) => state.snapPoint)
  const addDevice = useEditorStore((state) => state.addDevice)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const setSnapMode = useEditorStore((state) => state.setSnapMode)
  const loadEditorState = useEditorStore((state) => state.loadEditorState)

  const toggleSnapEnabled = useCallback(() => {
    setSnapConfig(prev => ({ ...prev, enabled: !prev.enabled }))
  }, [])

  const toggleSnapType = useCallback((type: SnapType) => {
    setSnapConfig(prev => {
      const next = [...prev.types]
      const idx = next.indexOf(type)
      if (idx >= 0) {
        next.splice(idx, 1)
      } else {
        next.push(type)
      }
      return { ...prev, types: next }
    })
  }, [])

  const setSnapTolerance = useCallback((tolerance: number) => {
    setSnapConfig(prev => ({ ...prev, tolerance }))
  }, [])

  const sortedFloors = useMemo(() => floors.slice().sort((a, b) => b.floor_number - a.floor_number), [floors])
  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId)
  const selectedFloor = floors.find((floor) => floor.id === selectedFloorId)
  const selectedDevice: SecurityDevice | null =
    selectedDeviceIdx != null && selectedDeviceIdx < devices.length ? (devices[selectedDeviceIdx] as SecurityDevice) : null

  const handleDeviceRefresh = useCallback(() => {
    selectDevice(null)
    setDeviceType('camera')
    setMode('select')
  }, [selectDevice, setMode])

  const loadBuildings = useCallback(async () => {
    try {
      const data = await listBuildings()
      setBuildings(data)
      setSelectedBuildingId((current) => {
        if (current && data.some((building) => building.id === current)) return current
        return data[0]?.id ?? ''
      })
    } catch {
      setBuildings([])
    }
  }, [])

  const syncDevicePlacements = useCallback(async (buildingId: number, floorId: number | '', nextDevices: SecurityDevice[]) => {
    const placements = await listObjectPlacements(buildingId)
    const editorDevicePlacements = placements.filter((placement) => placement.metadata?.editor_source === 'editor-device')
    await Promise.all(editorDevicePlacements.map((placement) => deleteObjectPlacement(placement.id)))
    await Promise.all(nextDevices.map((device) => createObjectPlacement(buildingId, placementFromDevice(device, floorId))))
  }, [])

  const loadBuildingFloors = useCallback(async (buildingId: number) => {
    setEditorHydrated(false)
    setSaveStatus('loading')
    try {
      const [data, uploads, snapshot, placements] = await Promise.all([
        listFloors(buildingId),
        listUploadsByBuilding(buildingId),
        getProjectSnapshot(buildingId).catch(() => null),
        listObjectPlacements(buildingId).catch(() => [] as ObjectPlacement[]),
      ])
      setFloors(data)
      setPointCloudUploads(uploads.filter((upload) => upload.source_type === 'pointcloud'))
      const editorSnapshot = snapshot?.saved ? snapshot.state.editor : null
      const placementDevices = placements.map(deviceFromPlacement).filter((device): device is SecurityDevice => device !== null)
      if (isEditorSnapshot(editorSnapshot)) {
        loadEditorState({
          ...(Array.isArray(editorSnapshot.walls) ? { walls: editorSnapshot.walls } : {}),
          ...(Array.isArray(editorSnapshot.rooms) ? { rooms: editorSnapshot.rooms } : {}),
          devices: Array.isArray(editorSnapshot.devices) ? editorSnapshot.devices : placementDevices,
          ...(editorSnapshot.visibleLayers ? { visibleLayers: editorSnapshot.visibleLayers } : {}),
          ...(editorSnapshot.snapMode ? { snapMode: editorSnapshot.snapMode } : {}),
        })
        if (editorSnapshot.viewMode) setViewMode(editorSnapshot.viewMode)
      } else {
        loadSample()
        if (placementDevices.length > 0) {
          loadEditorState({ devices: placementDevices })
        }
      }
      setSelectedFloorId((current) => {
        if (isEditorSnapshot(editorSnapshot) && editorSnapshot.selectedFloorId && data.some((floor) => floor.id === editorSnapshot.selectedFloorId)) {
          return editorSnapshot.selectedFloorId
        }
        if (current && data.some((floor) => floor.id === current)) return current
        return data[0]?.id ?? ''
      })
      setEditorHydrated(true)
      setSaveStatus(snapshot?.saved ? 'saved' : 'idle')
    } catch {
      setFloors([])
      setPointCloudUploads([])
      setSelectedFloorId('')
      setEditorHydrated(false)
      setSaveStatus('error')
    }
  }, [loadEditorState, loadSample])

  useEffect(() => { loadBuildings() }, [loadBuildings])

  useEffect(() => {
    if (selectedBuildingId !== '') {
      loadBuildingFloors(selectedBuildingId)
    } else {
      setFloors([])
      setPointCloudUploads([])
      setSelectedFloorId('')
      setEditorHydrated(false)
    }
  }, [loadBuildingFloors, selectedBuildingId])

  const visiblePointCloudUploads = useMemo(() => {
    if (selectedFloorId === '') return pointCloudUploads
    return pointCloudUploads.filter((upload) => upload.floor_id === null || upload.floor_id === selectedFloorId)
  }, [pointCloudUploads, selectedFloorId])

  useEffect(() => {
    if (selectedBuildingId !== '' || initialized) return
    loadSample()
    setInitialized(true)
  }, [initialized, loadSample, selectedBuildingId])

  useEffect(() => {
    if (selectedBuildingId === '' || !editorHydrated) return undefined
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = window.setTimeout(() => {
      setSaveStatus('saving')
      saveProjectSnapshot(selectedBuildingId, {
        editor: {
          walls,
          rooms,
          devices,
          visibleLayers,
          snapMode,
          viewMode,
          selectedFloorId,
          pointCloudUploadIds: visiblePointCloudUploads.map((upload) => upload.id),
          updatedAt: new Date().toISOString(),
        },
      })
        .then(() => syncDevicePlacements(selectedBuildingId, selectedFloorId, devices))
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'))
    }, 900)
    return () => {
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current)
    }
  }, [
    devices,
    editorHydrated,
    rooms,
    selectedBuildingId,
    selectedFloorId,
    snapMode,
    syncDevicePlacements,
    viewMode,
    visibleLayers,
    visiblePointCloudUploads,
    walls,
  ])

  const handleAddFloor = async () => {
    if (selectedBuildingId === '') return
    const nextNumber = (sortedFloors[0]?.floor_number ?? floors.length) + 1
    await createFloor(selectedBuildingId, {
      floor_number: nextNumber,
      floor_name: `${nextNumber}${labels.floorSuffix}`,
      height_meters: 3.2,
    })
    await loadBuildingFloors(selectedBuildingId)
  }

  const handleAddOpening = (type: 'door' | 'window' | 'opening', wallIdx: number, _pos: number) => {
    // Placeholder - stores will be expanded for doors/windows/openings
    pushHistory()
  }

  const renderCanvas2d = () => (
    <Canvas2DViewer
      walls={walls}
      rooms={rooms}
      devices={devices}
      selectedWallIdx={selectedWallIdx}
      selectedRoomIdx={selectedRoomIdx}
      selectedDeviceIdx={selectedDeviceIdx}
      visibleLayers={visibleLayers}
      editMode={mode}
      onSelectWall={(idx) => selectWall(idx >= 0 ? idx : null)}
      onSelectRoom={(idx) => selectRoom(idx >= 0 ? idx : null)}
      onSelectDevice={(idx) => selectDevice(idx >= 0 ? idx : null)}
      onDrawWall={(x1, y1, x2, y2) => addWall(x1, y1, x2, y2)}
      onAddRoom={(room) => addRoom(room)}
      onAddOpening={handleAddOpening}
      onDeleteAt={(wx, wy) => deleteWallAt(wx, wy)}
      onMoveWall={(idx, dx, dy) => moveWall(idx, dx, dy)}
      onFinishMoveWall={() => pushHistory()}
      snapPoint={(x, y) => snapPoint(x, y)}
      onAddDevice={(device) => addDevice(device)}
      deviceType={deviceType}
    />
  )

  const renderCanvas3d = () => (
    <Suspense fallback={<div className="viewer-placeholder">{labels.loading3d}</div>}>
      <ThreeJSViewer
        walls={walls}
        rooms={rooms}
        devices={devices}
        selectedDeviceIdx={selectedDeviceIdx}
      />
    </Suspense>
  )

  const renderPointCloudObjects = () => {
    if (visiblePointCloudUploads.length === 0) {
      return (
        <div className="editor-pointcloud-empty">
          <strong>PointCloud source not connected</strong>
          <span>Upload LAS/LAZ/PLY from Data Sources or PointCloud page to create scene objects.</span>
        </div>
      )
    }

    return (
      <>
        <div className="editor-pointcloud-stage">
          <Suspense fallback={<div className="viewer-placeholder">{labels.loading3d}</div>}>
            <ThreeJSViewer pointClouds={visiblePointCloudUploads} />
          </Suspense>
          <div className="editor-pointcloud-object-list">
            {visiblePointCloudUploads.map((upload, index) => (
              <article key={upload.id} className="editor-pointcloud-object-card">
                <strong>{upload.filename}</strong>
                <span>{upload.status === 'ready' ? 'Generating point object' : upload.status}</span>
                <small>{upload.floor_id ? `Floor #${upload.floor_id}` : 'Building level'}</small>
                <i style={{ width: `${Math.min(92, 34 + index * 12)}%` }} />
              </article>
            ))}
          </div>
        </div>
        <PointCloudGenerationMeter uploads={visiblePointCloudUploads} />
      </>
    )
  }

  const renderViewport = () => {
    switch (viewMode) {
      case '2d':
        return (
          <div className="editor-view-pane single">
            <span className="editor-view-label">2D</span>
            {renderCanvas2d()}
          </div>
        )
      case '3d':
        return (
          <div className="editor-view-pane single">
            <span className="editor-view-label">3D</span>
            {renderCanvas3d()}
          </div>
        )
      case 'split':
        return (
          <div className="editor-split-view">
            <div className="editor-view-pane">
              <span className="editor-view-label">2D</span>
              {renderCanvas2d()}
            </div>
            <div className="editor-view-divider" />
            <div className="editor-view-pane">
              <span className="editor-view-label">3D</span>
              {renderCanvas3d()}
            </div>
          </div>
        )
      case 'pointcloud':
        return (
          <div className="editor-pointcloud-scene">
            <span className="editor-view-label">PointCloud</span>
            {renderPointCloudObjects()}
          </div>
        )
      case 'ifc':
        return (
          <div className="editor-ifc-scene">
            <span className="editor-view-label">IFC</span>
            <strong>IFC model viewport</strong>
          </div>
        )
      default:
        return null
    }
  }
  return (
    <section className="editor-scene-page">
      <PageHeader eyebrow={labels.eyebrow} title={labels.title} description={labels.description} />

      <div className="editor-scene-shell">
        {/* ── Left Sidebar: Buildings + Floors + Layers ── */}
        <aside className="editor-scene-sidebar">
          {/* Building name */}
          <section className="editor-sidebar-section">
            <div className="editor-scene-panel-title compact">
              <span className="eyebrow-muted">{labels.building}</span>
            </div>
            {selectedBuilding ? (
              <div className="editor-building-name">
                <strong>{selectedBuilding.name}</strong>
              </div>
            ) : (
              <p className="editor-floor-empty">{labels.noBuilding}</p>
            )}
          </section>
          <div className="editor-sidebar-divider" />

          {/* Floor stack */}
          <section className="editor-sidebar-section">
            <div className="editor-scene-panel-title compact">
              <span className="eyebrow-muted">{labels.floorStack}</span>
            </div>
            <div className="editor-floor-list">
              {sortedFloors.map((floor) => (
                <button
                  key={floor.id}
                  className={floor.id === selectedFloorId ? 'selected' : ''}
                  onClick={() => setSelectedFloorId(floor.id)}
                  type="button"
                >
                  <strong>{floorLabel(floor, labels.floorSuffix)}</strong>
                </button>
              ))}
              {sortedFloors.length === 0 && (
                <p className="editor-floor-empty">{labels.noFloors}</p>
              )}
            </div>
            <button
              className="editor-floor-add-btn"
              onClick={handleAddFloor}
              type="button"
              disabled={selectedBuildingId === ''}
            >
              + {labels.addFloor}
            </button>
            <div className="editor-sidebar-divider" />
            <div className="editor-sidebar-label">전층 보기</div>
            <button
              className={'editor-all-floors-btn' + (allFloorsView ? ' active' : '')}
              onClick={() => setAllFloorsView((v) => !v)}
              type="button"
              disabled={sortedFloors.length === 0}
            >
              <span>전층 보기</span>
            </button>
            <div className="editor-sidebar-divider" />
            <div className="editor-sidebar-label">파일 업로드</div>
            <div className="editor-upload-actions">
              <button
                className="editor-sidebar-btn"
                onClick={() => setIsUploadOpen(true)}
                type="button"
              >
                <Upload size={14} />
                <span>업로드</span>
              </button>
              <button
                className="editor-sidebar-btn"
                onClick={() => setIsExportOpen(true)}
                type="button"
              >
                <Download size={14} />
                <span>내보내기</span>
              </button>
            </div>
          </section>
          <EnhancedLayerPanel />
        </aside>

        {/* ── Center: Viewport ── */}
        <main className="editor-scene-main">
          {/* Top toolbar: Undo/Redo */}
          <ViewToolbar />
          <div className={`editor-autosave-pill ${saveStatus}`}>
            {editorSaveLabel(saveStatus, language)}
          </div>
          {/* Viewport */}
          <div className="editor-scene-viewport" data-fit-trigger={fitViewTrigger}>
            {renderViewport()}

            {/* Drawing Toolbar - floating bottom-left */}
            <div className="editor-viewport-overlay-bottom-left">
              <DrawingToolbar
                mode={mode}
                onChange={setMode}
                onLoadSample={loadSample}
                onClear={clearAll}
                wallCount={walls.length}
                deviceType={deviceType}
                onDeviceTypeChange={setDeviceType}
              />
            </div>
          </div>
          {/* Bottom toolbar: View mode buttons */}
          <ViewModeBar
            viewMode={viewMode}
            viewModes={viewModes}
            labels={labels.modes}
            onViewModeChange={setViewMode}
          />
        </main>

        {/* ── Right Sidebar: Settings + Snap + Devices + Properties ── */}
        <aside className="editor-scene-rightbar">
          {/* Settings */}
          <section className="editor-settings-card">
            <div className="editor-scene-panel-title compact">
              <span className="eyebrow-muted">{labels.settings}</span>
            </div>
            <div className="device-size-row">
              <label className="device-size-label">{labels.deviceSize}</label>
              <input
                type="range"
                className="device-size-slider"
                min="1"
                max="20"
                step="0.5"
                value={deviceScale}
                onChange={(event) => setDeviceScale(Number(event.target.value))}
              />
              <strong className="device-size-mult">{deviceScale}x</strong>
            </div>
          </section>

          {/* Object Snap */}
          <ObjectSnapPanel
            snapConfig={snapConfig}
            onToggleEnabled={toggleSnapEnabled}
            onToggleType={toggleSnapType}
            onChangeRadius={setSnapTolerance}
          />

          {/* Device Panel */}
          <EnhancedDevicePanel
            devices={devices}
            selectedDeviceIdx={selectedDeviceIdx}
            deviceType={deviceType}
            onDeviceTypeChange={setDeviceType}
            onSelectDevice={selectDevice}
            onRemoveDevice={removeDevice}
            onStartAddDevice={() => setMode('device')}
            onRefresh={handleDeviceRefresh}
          />

          {/* Properties */}
          <PropertyPanel
            selectedWall={selectedWallIdx != null && selectedWallIdx < walls.length ? walls[selectedWallIdx]! : null}
            wallIndex={selectedWallIdx}
            wallCount={walls.length}
            roomCount={rooms.length}
            rooms={rooms}
            selectedRoomIdx={selectedRoomIdx}
            selectedDevice={selectedDevice}
            selectedDeviceIdx={selectedDeviceIdx}
            deviceCount={devices.length}
          />
        </aside>
      </div>
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        buildings={buildings}
        floors={floors}
        selectedBuildingId={selectedBuildingId}
        selectedFloorId={selectedFloorId}
        onUploaded={() => {
          if (selectedBuildingId !== '') return loadBuildingFloors(selectedBuildingId)
          return undefined
        }}
      />
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        buildingName={selectedBuilding?.name}
        floorName={selectedFloor ? floorLabel(selectedFloor, labels.floorSuffix) : undefined}
      />
      <FloorPositionModal
        isOpen={allFloorsView}
        onClose={() => setAllFloorsView(false)}
        floors={sortedFloors}
        selectedFloorId={selectedFloorId}
        onSelectFloor={(floorId) => setSelectedFloorId(floorId)}
      />
    </section>
  )
}
