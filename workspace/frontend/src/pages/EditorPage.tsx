import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Upload, Download } from '../components/Icons'
import { ViewToolbar } from '../components/ViewToolbar'
import { ViewModeBar } from '../components/ViewModeBar'
import { ObjectSnapPanel } from '../components/ObjectSnapPanel'

import { listBuildings, type Building } from '../api/buildings'
import { createFloor, listFloors, type Floor } from '../api/floors'
import { getFloorGeometry, syncFloorGeometry, type DoorGeometry, type WindowGeometry } from '../api/geometry'
import { usePreferences } from '../app/preferences'
import { Canvas2DViewer, type Room2D, type Wall2D, type WallOpening2D } from '../components/Canvas2DViewer'
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
import { FloorCreateModal } from '../components/FloorCreateModal'

import { SnapType, type SnapConfig } from '../utils/objectSnap'
import { generatePointCloudMesh, listUploadsByBuilding, type UploadAsset } from '../api/uploads'
import {
  getProjectSnapshot,
  listObjectPlacements,
  saveProjectSnapshotSection,
  syncObjectPlacements,
  type ObjectPlacement,
} from '../api/projectData'
import { preferredBuildingId, useProjectStore } from '../stores/projectStore'
import { useLayerStore, type LayerConfig, type LayerId } from '../stores/layerStore'
const ThreeJSViewer = lazy(() =>
  import('../components/ThreeJSViewer').then((module) => ({ default: module.ThreeJSViewer })),
)
import { CompassIndicator2D } from '../components/CompassIndicator2D'

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
type MeshProgressState = { percent: number; stage: string; remainingSeconds: number | null }
type EditorSaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'
type LoadBuildingFloorsOptions = { preferGeometryFloorId?: number }

const viewModes: ViewMode[] = ['2d', '3d', 'split', 'pointcloud', 'ifc']

const meshStageLabels = {
  en: {
    preparing: 'Preparing source data', reading_points: 'Reading PointCloud', downsampling: 'Preparing detail samples',
    filtering_noise: 'Removing scan noise', estimating_normals: 'Detecting surface edges', orienting_normals: 'Aligning surface directions',
    reconstructing_surface: 'Reconstructing continuous mesh', cleaning_surface: 'Cleaning isolated surfaces', optimizing_mesh: 'Optimizing triangles',
    baking_colors: 'Baking RGB colors', writing_mesh: 'Writing 3D mesh', completed: 'Mesh completed', failed: 'Mesh generation failed',
  },
  ko: {
    preparing: '원본 데이터 준비 중', reading_points: '포인트클라우드 읽는 중', downsampling: '세부 샘플 구성 중',
    filtering_noise: '스캔 노이즈 제거 중', estimating_normals: '표면 모서리 분석 중', orienting_normals: '표면 방향 정렬 중',
    reconstructing_surface: '연속 메시 재구성 중', cleaning_surface: '고립된 표면 정리 중', optimizing_mesh: '삼각형 최적화 중',
    baking_colors: 'RGB 색상 베이킹 중', writing_mesh: '3D 메시 저장 중', completed: '메시 생성 완료', failed: '메시 생성 실패',
  },
} as const

function formatRemainingTime(seconds: number, language: 'en' | 'ko') {
  const rounded = Math.max(1, Math.round(seconds))
  if (rounded < 60) return language === 'ko' ? `약 ${rounded}초 남음` : `About ${rounded}s remaining`
  const minutes = Math.floor(rounded / 60)
  const remainder = rounded % 60
  return language === 'ko' ? `약 ${minutes}분 ${remainder}초 남음` : `About ${minutes}m ${remainder}s remaining`
}
const POINTCLOUD_MAX_POINTS = 2_000_000

function floorLabel(floor: Floor, suffix: string) {
  return floor.floor_name ?? `${floor.floor_number}${suffix}`
}

function formatPointCount(value: number) {
  return new Intl.NumberFormat('ko-KR').format(value)
}

function isEditorSnapshot(value: unknown): value is {
  walls?: Wall2D[]
  rooms?: Room2D[]
  openings?: WallOpening2D[]
  devices?: SecurityDevice[]
  visibleLayers?: Partial<ReturnType<typeof useEditorStore.getState>['visibleLayers']>
  snapMode?: 'grid' | 'endpoint' | 'both' | 'none'
  viewMode?: ViewMode
  selectedFloorId?: number | ''
  layerConfigs?: Partial<LayerConfig>[]
} {
  return typeof value === 'object' && value !== null
}

function isPointCloudSnapshot(value: unknown): value is {
  selected_upload_ids_by_floor?: Record<string, number[]>
  selected_upload_ids?: number[]
  selected_floor_id?: number | null
} {
  return typeof value === 'object' && value !== null
}

function floorSelectionKey(floorId: number | '') {
  return floorId === '' ? 'building' : String(floorId)
}

function roomToGeometry(room: Room2D) {
  return {
    name: room.label?.trim() || 'Room',
    x: room.x,
    y: room.y,
    w: room.w,
    h: room.h,
    points: room.points ?? null,
  }
}

function roomFromGeometry(room: { x: number; y: number; w: number; h: number; name: string; points?: Array<{ x: number; y: number }> | null }): Room2D {
  const nextRoom: Room2D = {
    x: room.x,
    y: room.y,
    w: room.w,
    h: room.h,
    label: room.name,
    generated: Boolean(room.points && room.points.length >= 3),
  }
  if (room.points && room.points.length >= 3) nextRoom.points = room.points
  return nextRoom
}

function nearestPointOnWall(x: number, y: number, wall: Wall2D) {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return { x: wall.x1, y: wall.y1, position: 0 }
  const t = Math.max(0, Math.min(1, ((x - wall.x1) * dx + (y - wall.y1) * dy) / lenSq))
  return { x: wall.x1 + dx * t, y: wall.y1 + dy * t, position: t }
}

function openingPoint(opening: WallOpening2D, walls: Wall2D[]) {
  const wall = walls[opening.wallIdx]
  if (!wall) return null
  const x = wall.x1 + (wall.x2 - wall.x1) * opening.position
  const y = wall.y1 + (wall.y2 - wall.y1) * opening.position
  const rotation_degrees = (Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1) * 180) / Math.PI
  return { x, y, rotation_degrees }
}

function openingsToDoorGeometry(openings: WallOpening2D[], walls: Wall2D[]): DoorGeometry[] {
  return openings
    .filter((opening) => opening.type !== 'window')
    .reduce<DoorGeometry[]>((items, opening) => {
      const point = openingPoint(opening, walls)
      if (!point) return items
      items.push({
        x: point.x,
        y: point.y,
        width: opening.width,
        rotation_degrees: point.rotation_degrees,
        door_type: opening.type === 'opening' ? 'opening' : 'door',
      })
      return items
    }, [])
}

function openingsToWindowGeometry(openings: WallOpening2D[], walls: Wall2D[]): WindowGeometry[] {
  return openings
    .filter((opening) => opening.type === 'window')
    .reduce<WindowGeometry[]>((items, opening) => {
      const point = openingPoint(opening, walls)
      if (!point) return items
      items.push({
        x: point.x,
        y: point.y,
        width: opening.width,
        rotation_degrees: point.rotation_degrees,
        window_type: 'window',
        sill_height_meters: 0.9,
      })
      return items
    }, [])
}

function geometryToOpenings(doors: DoorGeometry[] | undefined, windows: WindowGeometry[] | undefined, walls: Wall2D[]): WallOpening2D[] {
  const fromDoor = (doors ?? []).map((door) => {
    const wallIdx = nearestWallIndex(door.x, door.y, walls)
    if (wallIdx < 0) return null
    const wall = walls[wallIdx]!
    const point = nearestPointOnWall(door.x, door.y, wall)
    return {
      type: door.door_type === 'opening' ? 'opening' as const : 'door' as const,
      wallIdx,
      position: point.position,
      width: door.width,
    }
  })
  const fromWindow = (windows ?? []).map((window) => {
    const wallIdx = nearestWallIndex(window.x, window.y, walls)
    if (wallIdx < 0) return null
    const wall = walls[wallIdx]!
    const point = nearestPointOnWall(window.x, window.y, wall)
    return { type: 'window' as const, wallIdx, position: point.position, width: window.width }
  })
  return [...fromDoor, ...fromWindow].filter((item): item is WallOpening2D => item !== null)
}

function nearestWallIndex(x: number, y: number, walls: Wall2D[]) {
  let bestIdx = -1
  let bestDistance = Infinity
  for (const [idx, wall] of walls.entries()) {
    const point = nearestPointOnWall(x, y, wall)
    const distance = Math.hypot(x - point.x, y - point.y)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIdx = idx
    }
  }
  return bestDistance <= 1.2 ? bestIdx : -1
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
  const globalSelectedBuildingId = useProjectStore((state) => state.selectedBuildingId)
  const setGlobalSelectedBuildingId = useProjectStore((state) => state.setSelectedBuildingId)
  const [floors, setFloors] = useState<Floor[]>([])
  const [selectedFloorId, setSelectedFloorId] = useState<number | ''>('')
  const selectedBuildingIdRef = useRef<number | ''>(selectedBuildingId)
  const selectedFloorIdRef = useRef<number | ''>(selectedFloorId)
  const [allFloorsView, setAllFloorsView] = useState(false)
  const [isFloorCreateOpen, setIsFloorCreateOpen] = useState(false)
  const [creatingFloor, setCreatingFloor] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [deviceType, setDeviceType] = useState<SecurityDeviceType>('camera')
  const [deviceScale, setDeviceScale] = useState(5)
  const [fitViewTrigger, setFitViewTrigger] = useState(0)
  const [pointCloudUploads, setPointCloudUploads] = useState<UploadAsset[]>([])
  const [pointCloudRenderMode, setPointCloudRenderMode] = useState<'points' | 'mesh'>('points')
  const [meshingPointCloudId, setMeshingPointCloudId] = useState<number | null>(null)
  const [meshProgress, setMeshProgress] = useState<MeshProgressState | null>(null)
  const [pointCloudMeshError, setPointCloudMeshError] = useState<string | null>(null)
  const [pointCloudSelectionByFloor, setPointCloudSelectionByFloor] = useState<Record<string, number[]>>({})
  const objectPlacementsRef = useRef<ObjectPlacement[]>([])
  const [editorHydrated, setEditorHydrated] = useState(false)
  const [floorSceneHydrated, setFloorSceneHydrated] = useState(false)
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
  const openings = useEditorStore((state) => state.openings)
  const devices = useEditorStore((state) => state.devices)
  const selectedWallIdx = useEditorStore((state) => state.selectedWallIdx)
  const selectedRoomIdx = useEditorStore((state) => state.selectedRoomIdx)
  const selectedOpeningIdx = useEditorStore((state) => state.selectedOpeningIdx)
  const selectedDeviceIdx = useEditorStore((state) => state.selectedDeviceIdx)
  const visibleLayers = useEditorStore((state) => state.visibleLayers)
  const layerConfigs = useLayerStore((state) => state.layers)
  const setLayerConfigs = useLayerStore((state) => state.setLayers)
  const snapMode = useEditorStore((state) => state.snapMode)
  const setMode = useEditorStore((state) => state.setMode)
  const addWall = useEditorStore((state) => state.addWall)
  const addWalls = useEditorStore((state) => state.addWalls)
  const addOpening = useEditorStore((state) => state.addOpening)
  const selectWall = useEditorStore((state) => state.selectWall)
  const selectRoom = useEditorStore((state) => state.selectRoom)
  const selectOpening = useEditorStore((state) => state.selectOpening)
  const selectDevice = useEditorStore((state) => state.selectDevice)
  const clearSelection = useEditorStore((state) => state.clearSelection)
  const deleteWallAt = useEditorStore((state) => state.deleteWallAt)
  const removeDevice = useEditorStore((state) => state.removeDevice)
  const removeOpening = useEditorStore((state) => state.removeOpening)
  const removeSelected = useEditorStore((state) => state.removeSelected)
  const updateDevice = useEditorStore((state) => state.updateDevice)
  const updateRoom = useEditorStore((state) => state.updateRoom)
  const updateWall = useEditorStore((state) => state.updateWall)
  const updateOpening = useEditorStore((state) => state.updateOpening)
  const updateWallEndpoint = useEditorStore((state) => state.updateWallEndpoint)
  const loadSample = useEditorStore((state) => state.loadSample)
  const pushHistory = useEditorStore((state) => state.pushHistory)
  const snapPoint = useEditorStore((state) => state.snapPoint)
  const addDevice = useEditorStore((state) => state.addDevice)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const setSnapMode = useEditorStore((state) => state.setSnapMode)
  const loadEditorState = useEditorStore((state) => state.loadEditorState)
  const [showWallEndpoints, setShowWallEndpoints] = useState(true)

  useEffect(() => {
    selectedBuildingIdRef.current = selectedBuildingId
  }, [selectedBuildingId])

  useEffect(() => {
    selectedFloorIdRef.current = selectedFloorId
  }, [selectedFloorId])

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

  useEffect(() => {
    if (!snapConfig.enabled) {
      setSnapMode('none')
      return
    }
    const gridEnabled = snapConfig.types.includes(SnapType.GRID)
    const endpointEnabled = snapConfig.types.includes(SnapType.ENDPOINT)
    setSnapMode(gridEnabled && endpointEnabled ? 'both' : gridEnabled ? 'grid' : endpointEnabled ? 'endpoint' : 'none')
  }, [setSnapMode, snapConfig.enabled, snapConfig.types])

  const sortedFloors = useMemo(() => floors.slice().sort((a, b) => b.floor_number - a.floor_number), [floors])
  const nextFloorNumber = useMemo(() => Math.max(0, ...floors.map((floor) => floor.floor_number)) + 1, [floors])
  const existingFloorNumbers = useMemo(() => floors.map((floor) => floor.floor_number), [floors])
  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId)
  const selectedFloor = floors.find((floor) => floor.id === selectedFloorId)
  const selectedDevice: SecurityDevice | null =
    selectedDeviceIdx != null && selectedDeviceIdx < devices.length ? (devices[selectedDeviceIdx] as SecurityDevice) : null
  const selectedOpening: WallOpening2D | null =
    selectedOpeningIdx != null && selectedOpeningIdx < openings.length ? (openings[selectedOpeningIdx] as WallOpening2D) : null
  const layerOpacity = useMemo(
    () => Object.fromEntries(layerConfigs.map((layer) => [layer.id, layer.opacity])) as Partial<Record<LayerId, number>>,
    [layerConfigs],
  )
  const layerVisibility = useMemo(
    () => Object.fromEntries(layerConfigs.map((layer) => [layer.id, layer.visible])) as Partial<Record<LayerId, boolean>>,
    [layerConfigs],
  )
  const renderVisibleLayers = useMemo(() => ({
    ...visibleLayers,
    walls: layerVisibility.walls !== false,
    rooms: layerVisibility.rooms !== false,
    openings: ['doors', 'windows', 'passages'].some((id) => layerVisibility[id as LayerId] !== false),
    grid: layerVisibility.grid !== false,
    floorPlan: layerVisibility['floor-plan'] !== false,
    devices: ['cameras', 'sensors', 'alarms', 'access'].some((id) => layerVisibility[id as LayerId] !== false),
    coverage: layerVisibility.coverage === true,
    heatmap: layerVisibility.heatmap === true,
    pathway: layerVisibility.pathway === true,
  }), [layerVisibility, visibleLayers])

  useEffect(() => {
    if (selectedWallIdx !== null && !renderVisibleLayers.walls) selectWall(null)
    if (selectedRoomIdx !== null && !renderVisibleLayers.rooms) selectRoom(null)
    if (selectedOpeningIdx !== null) {
      const opening = openings[selectedOpeningIdx]
      const layerId: LayerId | null = opening?.type === 'door'
        ? 'doors'
        : opening?.type === 'window'
          ? 'windows'
          : opening?.type === 'opening'
            ? 'passages'
            : null
      if (!opening || !renderVisibleLayers.openings || (layerId && layerVisibility[layerId] === false)) selectOpening(null)
    }
    if (selectedDeviceIdx !== null) {
      const device = devices[selectedDeviceIdx]
      const layerId: LayerId | null = device?.device_type === 'camera'
        ? 'cameras'
        : device?.device_type === 'sensor'
          ? 'sensors'
          : device?.device_type === 'alarm'
            ? 'alarms'
            : device?.device_type === 'access'
              ? 'access'
              : null
      if (!device || !renderVisibleLayers.devices || (layerId && layerVisibility[layerId] === false)) selectDevice(null)
    }
  }, [
    devices,
    layerVisibility,
    openings,
    renderVisibleLayers.devices,
    renderVisibleLayers.openings,
    renderVisibleLayers.rooms,
    renderVisibleLayers.walls,
    selectDevice,
    selectOpening,
    selectRoom,
    selectWall,
    selectedDeviceIdx,
    selectedOpeningIdx,
    selectedRoomIdx,
    selectedWallIdx,
  ])

  const handleDeviceRefresh = useCallback(() => {
    selectDevice(null)
    setDeviceType('camera')
    setMode('select')
  }, [selectDevice, setMode])

  const loadBuildings = useCallback(async () => {
    try {
      const data = await listBuildings()
      setBuildings(data)
      const next = preferredBuildingId(data, selectedBuildingIdRef.current)
      selectedBuildingIdRef.current = next ?? ''
      setSelectedBuildingId(next ?? '')
    } catch {
      setBuildings([])
    }
  }, [])

  const syncDevicePlacements = useCallback(async (buildingId: number, floorId: number | '', nextDevices: SecurityDevice[]) => {
    return syncObjectPlacements(buildingId, {
      metadata_scope_key: 'editor_source',
      metadata_scope_value: 'editor-device',
      floor_id: floorId === '' ? null : floorId,
      placements: nextDevices.map((device) => placementFromDevice(device, floorId)),
    })
  }, [])

  const loadFloorScene = useCallback(async (floorId: number, placements: ObjectPlacement[]) => {
    setFloorSceneHydrated(false)
    const floorGeometry = await getFloorGeometry(floorId).catch(() => null)
    const placementDevices = placements
      .filter((placement) => placement.floor_id === floorId)
      .map(deviceFromPlacement)
      .filter((device): device is SecurityDevice => device !== null)
    const nextWalls = floorGeometry?.walls.map((wall) => ({ x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 })) ?? []
    loadEditorState({
      walls: nextWalls,
      rooms: floorGeometry?.rooms.map(roomFromGeometry) ?? [],
      devices: placementDevices,
      openings: floorGeometry ? geometryToOpenings(floorGeometry.doors, floorGeometry.windows, nextWalls) : [],
    })
    setFloorSceneHydrated(true)
  }, [loadEditorState])

  const persistCurrentFloorScene = useCallback(async () => {
    if (selectedBuildingId === '' || selectedFloorId === '') return
    await syncFloorGeometry(selectedFloorId, {
      walls,
      rooms: rooms.map(roomToGeometry),
      doors: openingsToDoorGeometry(openings, walls),
      windows: openingsToWindowGeometry(openings, walls),
    })
    const syncedPlacements = await syncDevicePlacements(selectedBuildingId, selectedFloorId, devices)
    objectPlacementsRef.current = [
      ...objectPlacementsRef.current.filter((placement) => placement.floor_id !== selectedFloorId),
      ...syncedPlacements,
    ]
  }, [devices, openings, rooms, selectedBuildingId, selectedFloorId, syncDevicePlacements, walls])

  const loadBuildingFloors = useCallback(async (buildingId: number, options: LoadBuildingFloorsOptions = {}) => {
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
      objectPlacementsRef.current = placements
      const editorSnapshot = snapshot?.saved ? snapshot.state.editor : null
      const pointCloudSnapshot = snapshot?.saved ? snapshot.state.pointcloud : null
      if (isPointCloudSnapshot(pointCloudSnapshot)) {
        setPointCloudSelectionByFloor(pointCloudSnapshot.selected_upload_ids_by_floor ?? {
          [floorSelectionKey(pointCloudSnapshot.selected_floor_id ?? '')]: pointCloudSnapshot.selected_upload_ids ?? [],
        })
      } else {
        setPointCloudSelectionByFloor({})
      }
      const preferredFloorId = options.preferGeometryFloorId && data.some((floor) => floor.id === options.preferGeometryFloorId)
        ? options.preferGeometryFloorId
        : null
      const fallbackFloorId =
        preferredFloorId ??
        (isEditorSnapshot(editorSnapshot) && editorSnapshot.selectedFloorId && data.some((floor) => floor.id === editorSnapshot.selectedFloorId)
          ? editorSnapshot.selectedFloorId
          : data[0]?.id ?? null)
      const floorGeometry = fallbackFloorId !== null ? await getFloorGeometry(fallbackFloorId).catch(() => null) : null
      const placementDevices = placements
        .filter((placement) => placement.floor_id === fallbackFloorId)
        .map(deviceFromPlacement)
        .filter((device): device is SecurityDevice => device !== null)
      const editorPrefs = isEditorSnapshot(editorSnapshot)
        ? {
            ...(editorSnapshot.visibleLayers ? { visibleLayers: editorSnapshot.visibleLayers } : {}),
            ...(editorSnapshot.snapMode ? { snapMode: editorSnapshot.snapMode } : {}),
          }
        : {}
      if (isEditorSnapshot(editorSnapshot) && editorSnapshot.layerConfigs) {
        setLayerConfigs(editorSnapshot.layerConfigs)
      }
      if (floorGeometry) {
        const nextWalls = floorGeometry.walls.map((wall) => ({ x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 }))
        loadEditorState({
          walls: nextWalls,
          rooms: floorGeometry.rooms.map(roomFromGeometry),
          devices: placementDevices,
          openings: geometryToOpenings(floorGeometry.doors, floorGeometry.windows, nextWalls),
          ...editorPrefs,
        })
        if (isEditorSnapshot(editorSnapshot) && editorSnapshot.viewMode) setViewMode(editorSnapshot.viewMode)
      } else {
        loadEditorState({ walls: [], rooms: [], openings: [], devices: placementDevices, ...editorPrefs })
        if (isEditorSnapshot(editorSnapshot) && editorSnapshot.viewMode) setViewMode(editorSnapshot.viewMode)
      }
      const snapshotFloorId = isEditorSnapshot(editorSnapshot) ? editorSnapshot.selectedFloorId : null
      const nextFloorId = preferredFloorId !== null
        ? preferredFloorId
        : snapshotFloorId && data.some((floor) => floor.id === snapshotFloorId)
          ? snapshotFloorId
          : selectedFloorIdRef.current && data.some((floor) => floor.id === selectedFloorIdRef.current)
            ? selectedFloorIdRef.current
            : data[0]?.id ?? ''
      selectedFloorIdRef.current = nextFloorId
      setSelectedFloorId(nextFloorId)
      setEditorHydrated(true)
      setFloorSceneHydrated(true)
      setSaveStatus(snapshot?.saved ? 'saved' : 'idle')
    } catch {
      setFloors([])
      setPointCloudUploads([])
      setPointCloudSelectionByFloor({})
      objectPlacementsRef.current = []
      setSelectedFloorId('')
      setEditorHydrated(false)
      setFloorSceneHydrated(false)
      setSaveStatus('error')
    }
  }, [loadEditorState, setLayerConfigs])

  useEffect(() => { loadBuildings() }, [loadBuildings])

  useEffect(() => {
    if (buildings.length === 0) {
      if (selectedBuildingId !== '') setSelectedBuildingId('')
      if (globalSelectedBuildingId !== null) setGlobalSelectedBuildingId(null)
      return
    }

    const hasGlobal = globalSelectedBuildingId !== null && buildings.some((building) => building.id === globalSelectedBuildingId)
    const hasLocal = selectedBuildingId !== '' && buildings.some((building) => building.id === selectedBuildingId)
    const next = hasGlobal ? globalSelectedBuildingId : hasLocal ? selectedBuildingId : buildings[0]!.id
    if (selectedBuildingId !== next) setSelectedBuildingId(next)
    if (globalSelectedBuildingId !== next) setGlobalSelectedBuildingId(next)
  }, [buildings, globalSelectedBuildingId, selectedBuildingId, setGlobalSelectedBuildingId])

  useEffect(() => {
    if (selectedBuildingId !== '') {
      loadBuildingFloors(selectedBuildingId)
    } else {
      setFloors([])
      setPointCloudUploads([])
      setPointCloudSelectionByFloor({})
      objectPlacementsRef.current = []
      setSelectedFloorId('')
      setEditorHydrated(false)
      setFloorSceneHydrated(false)
    }
  }, [loadBuildingFloors, selectedBuildingId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (selectedWallIdx === null && selectedRoomIdx === null && selectedOpeningIdx === null && selectedDeviceIdx === null) return
      event.preventDefault()
      removeSelected()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [removeSelected, selectedDeviceIdx, selectedOpeningIdx, selectedRoomIdx, selectedWallIdx])

  useEffect(() => {
    if (!editorHydrated || selectedFloorId === '') return undefined
    let cancelled = false
    loadFloorScene(selectedFloorId, objectPlacementsRef.current)
      .then(() => {
        if (cancelled) setFloorSceneHydrated(false)
      })
      .catch(() => {
        if (!cancelled) {
          loadEditorState({ walls: [], rooms: [], openings: [], devices: [] })
          setFloorSceneHydrated(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [editorHydrated, loadEditorState, loadFloorScene, selectedFloorId])

  const visiblePointCloudUploads = useMemo(() => {
    const floorScoped = selectedFloorId === ''
      ? pointCloudUploads
      : pointCloudUploads.filter((upload) => upload.floor_id === null || upload.floor_id === selectedFloorId)
    const selectedIds = pointCloudSelectionByFloor[floorSelectionKey(selectedFloorId)]
    if (!selectedIds || selectedIds.length === 0) return floorScoped
    const selectedIdSet = new Set(selectedIds)
    return floorScoped.filter((upload) => selectedIdSet.has(upload.id))
  }, [pointCloudSelectionByFloor, pointCloudUploads, selectedFloorId])

  const handleGeneratePointCloudMesh = useCallback(async (upload: UploadAsset, showAfterGeneration = false) => {
    if (selectedBuildingId === '' || meshingPointCloudId !== null) return
    setMeshingPointCloudId(upload.id)
    setMeshProgress({ percent: 1, stage: 'preparing', remainingSeconds: null })
    setPointCloudMeshError(null)
    const startedAt = Date.now()
    const expectedDurationSeconds = 180
    const progressTimer = window.setInterval(() => {
      const elapsedSeconds = Math.max(0, (Date.now() - startedAt) / 1000)
      const percent = Math.min(96, 1 + elapsedSeconds / expectedDurationSeconds * 95)
      const stage = percent < 8 ? 'reading_points'
        : percent < 18 ? 'downsampling'
          : percent < 28 ? 'filtering_noise'
            : percent < 38 ? 'estimating_normals'
              : percent < 47 ? 'orienting_normals'
                : percent < 80 ? 'reconstructing_surface'
                  : percent < 87 ? 'cleaning_surface'
                    : percent < 92 ? 'optimizing_mesh'
                      : percent < 97 ? 'baking_colors'
                        : 'writing_mesh'
      setMeshProgress({
        percent,
        stage,
        remainingSeconds: Math.max(1, expectedDurationSeconds - elapsedSeconds),
      })
    }, 500)
    try {
      await generatePointCloudMesh(upload.id)
      const refreshed = await listUploadsByBuilding(selectedBuildingId)
      setPointCloudUploads(refreshed.filter((asset) => asset.source_type === 'pointcloud'))
      if (showAfterGeneration) setPointCloudRenderMode('mesh')
      setMeshProgress({ percent: 100, stage: 'completed', remainingSeconds: 0 })
      await new Promise((resolve) => window.setTimeout(resolve, 700))
    } catch (error) {
      setMeshProgress({ percent: 100, stage: 'failed', remainingSeconds: null })
      setPointCloudMeshError(error instanceof Error ? error.message : language === 'ko' ? '메시 생성에 실패했습니다.' : 'Mesh generation failed.')
    } finally {
      window.clearInterval(progressTimer)
      setMeshingPointCloudId(null)
      setMeshProgress(null)
    }
  }, [language, meshingPointCloudId, selectedBuildingId])

  useEffect(() => {
    if (selectedBuildingId === '' || !editorHydrated || !floorSceneHydrated) return undefined
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = window.setTimeout(() => {
      setSaveStatus('saving')
      saveProjectSnapshotSection(selectedBuildingId, 'editor', {
        walls,
        rooms,
        openings,
        devices,
        visibleLayers,
        layerConfigs: layerConfigs.map((layer) => ({
          id: layer.id,
          visible: layer.visible,
          opacity: layer.opacity,
        })),
        snapMode,
        viewMode,
        selectedFloorId,
        pointCloudUploadIds: visiblePointCloudUploads.map((upload) => upload.id),
        updatedAt: new Date().toISOString(),
      })
        .then(() => {
          if (selectedFloorId === '') return undefined
          return syncFloorGeometry(selectedFloorId, {
            walls,
            rooms: rooms.map(roomToGeometry),
            doors: openingsToDoorGeometry(openings, walls),
            windows: openingsToWindowGeometry(openings, walls),
          })
        })
        .then(() => {
          if (selectedFloorId === '') return []
          return syncDevicePlacements(selectedBuildingId, selectedFloorId, devices)
        })
        .then((syncedPlacements) => {
          if (selectedFloorId !== '') {
            objectPlacementsRef.current = [
              ...objectPlacementsRef.current.filter((placement) => placement.floor_id !== selectedFloorId),
              ...syncedPlacements,
            ]
          }
        })
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'))
    }, 900)
    return () => {
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current)
    }
  }, [
    devices,
    editorHydrated,
    floorSceneHydrated,
    layerConfigs,
    openings,
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

  const handleCreateFloor = async ({ floorNumber, floorName }: { floorNumber: number; floorName: string }) => {
    if (selectedBuildingId === '') return
    setCreatingFloor(true)
    try {
      const created = await createFloor(selectedBuildingId, {
        floor_number: floorNumber,
        floor_name: floorName,
        height_meters: 3.2,
        input_type: 'manual',
      })
      await loadBuildingFloors(selectedBuildingId, { preferGeometryFloorId: created.id })
      setIsFloorCreateOpen(false)
    } finally {
      setCreatingFloor(false)
    }
  }

  const handleFloorSelect = useCallback(async (floorId: number) => {
    if (floorId === selectedFloorId) return
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    setFloorSceneHydrated(false)
    setSaveStatus('saving')
    try {
      await persistCurrentFloorScene()
      setSelectedFloorId(floorId)
      setSaveStatus('loading')
    } catch {
      setSaveStatus('error')
    }
  }, [persistCurrentFloorScene, selectedFloorId])

  const renderCanvas2d = () => (
    <Canvas2DViewer
      walls={walls}
      rooms={rooms}
      openings={openings}
      devices={devices}
      selectedWallIdx={selectedWallIdx}
      selectedRoomIdx={selectedRoomIdx}
      selectedOpeningIdx={selectedOpeningIdx}
      selectedDeviceIdx={selectedDeviceIdx}
      visibleLayers={renderVisibleLayers}
      layerVisibility={layerVisibility}
      layerOpacity={layerOpacity}
      showEndpoints={showWallEndpoints}
      editMode={mode}
      onSelectWall={(idx) => selectWall(idx >= 0 ? idx : null)}
      onSelectRoom={(idx) => selectRoom(idx >= 0 ? idx : null)}
      onSelectOpening={(idx) => selectOpening(idx >= 0 ? idx : null)}
      onSelectDevice={(idx) => selectDevice(idx >= 0 ? idx : null)}
      onDrawWall={(x1, y1, x2, y2) => addWall(x1, y1, x2, y2)}
      onDrawWalls={(nextWalls) => addWalls(nextWalls)}
      onAddOpening={(opening) => addOpening(opening)}
      onDeleteAt={(wx, wy) => deleteWallAt(wx, wy)}
      onDeleteOpening={(idx) => removeOpening(idx)}
      onUpdateWall={(idx, wall, recordHistory) => updateWall(idx, wall, recordHistory)}
      onMoveWallEndpoint={(idx, endpoint, x, y, recordHistory) => updateWallEndpoint(idx, endpoint, x, y, recordHistory)}
      onBeginEdit={pushHistory}
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
        openings={openings}
        devices={devices}
        selectedWallIdx={selectedWallIdx}
        selectedRoomIdx={selectedRoomIdx}
        selectedOpeningIdx={selectedOpeningIdx}
        selectedDeviceIdx={selectedDeviceIdx}
        onSelectWall={selectWall}
        onSelectRoom={selectRoom}
        onSelectOpening={selectOpening}
        onSelectDevice={selectDevice}
        onSelectEmpty={clearSelection}
        visibleLayers={renderVisibleLayers}
        layerVisibility={layerVisibility}
        layerOpacity={layerOpacity}
        showAxisGizmo
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

    const activeMeshUpload = visiblePointCloudUploads.find((upload) => upload.id === meshingPointCloudId)
    const currentStageLabels = meshStageLabels[language]
    const meshStageLabel = meshProgress
      ? currentStageLabels[meshProgress.stage as keyof typeof currentStageLabels] ?? meshProgress.stage
      : ''
    const displayedMeshPercent = Math.round(meshProgress?.percent ?? 0)

    return (
      <>
        <div className="editor-pointcloud-stage">
          <Suspense fallback={<div className="viewer-placeholder">{labels.loading3d}</div>}>
            <ThreeJSViewer pointClouds={visiblePointCloudUploads} pointCloudRenderMode={pointCloudRenderMode} showAxisGizmo />
          </Suspense>
          {meshingPointCloudId !== null && meshProgress && (
            <div className="editor-mesh-progress-overlay" role="status" aria-live="polite">
              <div className="editor-mesh-progress-dialog">
                <div
                  className="editor-mesh-progress-ring"
                  style={{ background: `conic-gradient(#60a5fa ${displayedMeshPercent}%, rgba(96, 165, 250, 0.12) 0)` }}
                >
                  <span>{displayedMeshPercent}%</span>
                </div>
                <strong>{language === 'ko' ? '고해상도 3D 메시 생성' : 'Building High-detail 3D Mesh'}</strong>
                <p>{meshStageLabel}</p>
                <small>{activeMeshUpload?.filename}</small>
                <em>
                  {meshProgress.remainingSeconds !== null && displayedMeshPercent < 100
                    ? formatRemainingTime(meshProgress.remainingSeconds, language)
                    : language === 'ko' ? '잠시만 기다려 주세요' : 'Please wait'}
                </em>
              </div>
            </div>
          )}
          <div className="editor-pointcloud-object-list">
            {visiblePointCloudUploads.map((upload, index) => (
              <article key={upload.id} className="editor-pointcloud-object-card">
                <strong>{upload.filename}</strong>
                <span>{upload.pointcloud_mesh_url
                  ? (language === 'ko' ? 'Mesh 준비 완료' : 'Mesh ready')
                  : upload.status === 'ready'
                    ? (language === 'ko' ? 'Point 객체 준비 완료' : 'Point object ready')
                    : upload.status}</span>
                <small>{upload.floor_id ? `Floor #${upload.floor_id}` : 'Building level'}</small>
                <div className="editor-pointcloud-card-actions">
                  <button
                    type="button"
                    className={pointCloudRenderMode === 'points' ? 'active' : ''}
                    aria-pressed={pointCloudRenderMode === 'points'}
                    onClick={() => setPointCloudRenderMode('points')}
                  >
                    {language === 'ko' ? '포인트 보기' : 'Point View'}
                  </button>
                  <button
                    type="button"
                    className={pointCloudRenderMode === 'mesh' ? 'active' : ''}
                    aria-pressed={pointCloudRenderMode === 'mesh'}
                    disabled={meshingPointCloudId !== null || !upload.filename.toLowerCase().endsWith('.las')}
                    onClick={() => {
                      if (upload.pointcloud_mesh_url) setPointCloudRenderMode('mesh')
                      else void handleGeneratePointCloudMesh(upload, true)
                    }}
                  >
                    {meshingPointCloudId === upload.id
                      ? (language === 'ko' ? '표면 생성 중...' : 'Building Surface...')
                      : (language === 'ko' ? '표면 메시 보기' : 'Surface Mesh')}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={meshingPointCloudId !== null || !upload.filename.toLowerCase().endsWith('.las')}
                    title={!upload.filename.toLowerCase().endsWith('.las') ? 'LAS files are currently supported' : undefined}
                    onClick={() => handleGeneratePointCloudMesh(upload)}
                  >
                    {meshingPointCloudId === upload.id
                      ? (language === 'ko' ? '생성 중...' : 'Generating...')
                      : upload.pointcloud_mesh_url
                        ? (language === 'ko' ? '메시 재생성' : 'Regenerate Mesh')
                        : (language === 'ko' ? '메시 생성' : 'Generate Mesh')}
                  </button>
                </div>
                <i style={{ width: `${Math.min(92, 34 + index * 12)}%` }} />
              </article>
            ))}
          </div>
          {pointCloudMeshError && <div className="editor-pointcloud-mesh-error">{pointCloudMeshError}</div>}
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
            <CompassIndicator2D />
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
              <CompassIndicator2D />
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
            <CompassIndicator2D />
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
                  onClick={() => void handleFloorSelect(floor.id)}
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
              onClick={() => setIsFloorCreateOpen(true)}
              type="button"
              disabled={selectedBuildingId === '' || creatingFloor}
            >
              + {creatingFloor ? (language === 'ko' ? '생성 중...' : 'Creating...') : labels.addFloor}
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
          <ViewToolbar saveStatus={saveStatus} language={language} />
          {/* Viewport */}
          <div className="editor-scene-viewport" data-fit-trigger={fitViewTrigger}>
            {renderViewport()}

            {/* Drawing Toolbar - floating bottom-left */}
            <div className="editor-viewport-overlay-bottom-left">
              <DrawingToolbar
                mode={mode}
                language={language}
                onChange={setMode}
                onLoadSample={loadSample}
                onClear={removeSelected}
                wallCount={walls.length}
                deviceType={deviceType}
                onDeviceTypeChange={setDeviceType}
                showEndpoints={showWallEndpoints}
                onToggleEndpoints={() => setShowWallEndpoints((value) => !value)}
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
            language={language}
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
            language={language}
            selectedWall={selectedWallIdx != null && selectedWallIdx < walls.length ? walls[selectedWallIdx]! : null}
            wallIndex={selectedWallIdx}
            wallCount={walls.length}
            roomCount={rooms.length}
            rooms={rooms}
            selectedRoomIdx={selectedRoomIdx}
            selectedDevice={selectedDevice}
            selectedDeviceIdx={selectedDeviceIdx}
            selectedOpening={selectedOpening}
            selectedOpeningIdx={selectedOpeningIdx}
            deviceCount={devices.length}
            openingCount={openings.length}
            saveStatus={saveStatus}
            onBeginEdit={pushHistory}
            onUpdateWall={updateWall}
            onUpdateRoom={updateRoom}
            onUpdateDevice={updateDevice}
            onUpdateOpening={updateOpening}
            onDeleteSelected={removeSelected}
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
          if (selectedBuildingId !== '') {
            return loadBuildingFloors(selectedBuildingId, selectedFloorId === '' ? {} : { preferGeometryFloorId: selectedFloorId })
          }
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
      <FloorCreateModal
        isOpen={isFloorCreateOpen}
        language={language}
        defaultFloorNumber={nextFloorNumber}
        existingFloorNumbers={existingFloorNumbers}
        isSubmitting={creatingFloor}
        onClose={() => setIsFloorCreateOpen(false)}
        onSubmit={handleCreateFloor}
      />
    </section>
  )
}
