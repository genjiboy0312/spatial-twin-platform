import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

import type { Building, BuildingMapSettings } from '../../../api/buildings'
import type { Floor } from '../../../api/floors'
import type { SecurityDevice } from '../../../stores/editorStore'
import type { Room2D, Wall2D } from '../../../components/Canvas2DViewer'

export interface MonitorSpatialViewProps {
  building: Building | null
  mapSettings: BuildingMapSettings | null
  alignmentSnapshot: {
    buildingOrigin: LatLngTuple | null
    alignmentMatrix: number[][] | null
    osmQuadZoom: number | null
    osmQuadScale: number | null
    osmQuadOpacity: number | null
  } | null
  floors: Floor[]
  selectedFloorId: number | null
  walls: Wall2D[]
  rooms: Room2D[]
  devices: SecurityDevice[]
  selectedDeviceId: string | null
  showCoverage: boolean
  showGps: boolean
  showPointCloud: boolean
  onSelectDevice: (id: string) => void
}

type LatLngTuple = [number, number]

const TILE_URL = '/api/osm-tiles/{z}/{x}/{y}.png'
const DEFAULT_CENTER: LatLngTuple = [37.5665, 126.9784]
const TILE_SIZE = 256
const TILE_GRID_SIZE = 4
const TEXTURE_SIZE = TILE_SIZE * TILE_GRID_SIZE
const PLANE_SIZE = 400
const MAP_ZOOM = 17
const METERS_PER_DEGREE = 111_320

type ProjectPointMapper = (x: number, y: number) => { x: number; z: number }

function latLngToWorldPixel(latitude: number, longitude: number, zoom: number) {
  const clippedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude))
  const sinLat = Math.sin((clippedLatitude * Math.PI) / 180)
  const scale = TILE_SIZE * 2 ** zoom
  return {
    wx: ((longitude + 180) / 360) * scale,
    wy: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  }
}

function tileUrl(zoom: number, x: number, y: number) {
  return TILE_URL.replace('{z}', String(zoom)).replace('{x}', String(x)).replace('{y}', String(y))
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load OSM tile: ${url}`))
    image.src = url
  })
}

function drawFallbackMap(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#d9d8d3'
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)

  ctx.fillStyle = '#b8c69c'
  ctx.beginPath()
  ctx.moveTo(-80, 150)
  ctx.lineTo(330, 70)
  ctx.lineTo(TEXTURE_SIZE + 80, 150)
  ctx.lineTo(TEXTURE_SIZE + 80, 210)
  ctx.lineTo(340, 150)
  ctx.lineTo(-80, 250)
  ctx.closePath()
  ctx.fill()

  for (const [y, width] of [[250, 54], [410, 70], [610, 46]] as Array<[number, number]>) {
    ctx.save()
    ctx.translate(TEXTURE_SIZE / 2, y)
    ctx.rotate(-0.08)
    ctx.fillStyle = '#b9b9b9'
    ctx.fillRect(-TEXTURE_SIZE, -width / 2, TEXTURE_SIZE * 2, width)
    ctx.restore()
  }

  ctx.strokeStyle = 'rgba(59, 130, 246, 0.42)'
  ctx.lineWidth = 4
  ctx.strokeRect(104, 112, 168, 92)
  ctx.strokeRect(612, 116, 126, 84)
  ctx.strokeRect(214, 628, 210, 98)
}

function useOsmTexture(center: LatLngTuple, zoom: number) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const canvas = document.createElement('canvas')
    canvas.width = TEXTURE_SIZE
    canvas.height = TEXTURE_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    drawFallbackMap(ctx)
    const nextTexture = new THREE.CanvasTexture(canvas)
    nextTexture.colorSpace = THREE.SRGBColorSpace
    nextTexture.wrapS = THREE.ClampToEdgeWrapping
    nextTexture.wrapT = THREE.ClampToEdgeWrapping
    nextTexture.needsUpdate = true
    setTexture((current) => {
      current?.dispose()
      return nextTexture
    })
    setIsLoading(true)

    const { wx, wy } = latLngToWorldPixel(center[0], center[1], zoom)
    const startTileX = Math.floor(wx / TILE_SIZE) - 1
    const startTileY = Math.floor(wy / TILE_SIZE) - 1
    const tileCount = 2 ** zoom
    const jobs: Promise<void>[] = []

    for (let col = 0; col < TILE_GRID_SIZE; col += 1) {
      for (let row = 0; row < TILE_GRID_SIZE; row += 1) {
        const rawX = startTileX + col
        const rawY = startTileY + row
        if (rawY < 0 || rawY >= tileCount) continue
        const wrappedX = ((rawX % tileCount) + tileCount) % tileCount
        jobs.push(
          loadImage(tileUrl(zoom, wrappedX, rawY))
            .then((image) => {
              if (cancelled) return
              ctx.drawImage(
                image,
                rawX * TILE_SIZE - wx + TEXTURE_SIZE / 2,
                rawY * TILE_SIZE - wy + TEXTURE_SIZE / 2,
                TILE_SIZE,
                TILE_SIZE,
              )
              nextTexture.needsUpdate = true
            })
            .catch(() => {
              nextTexture.needsUpdate = true
            }),
        )
      }
    }

    Promise.allSettled(jobs).then(() => {
      if (cancelled) return
      nextTexture.needsUpdate = true
      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [center, zoom])

  useEffect(() => () => texture?.dispose(), [texture])

  return { texture, isLoading }
}

function deviceColor(deviceType: SecurityDevice['device_type']) {
  if (deviceType === 'alarm') return '#ef4444'
  if (deviceType === 'sensor') return '#38bdf8'
  if (deviceType === 'access') return '#facc15'
  return '#22c55e'
}

function latitudeScale(latitude: number) {
  return Math.max(0.1, Math.cos((latitude * Math.PI) / 180))
}

function gpsToScenePoint(latitude: number, longitude: number, center: LatLngTuple) {
  return {
    x: (longitude - center[1]) * METERS_PER_DEGREE * latitudeScale(center[0]),
    z: (latitude - center[0]) * METERS_PER_DEGREE,
  }
}

function transformLocalToGps(matrix: number[][] | null, x: number, y: number) {
  if (!matrix) return null
  const row0 = matrix[0]
  const row1 = matrix[1]
  if (!row0 || !row1) return null
  const a = row0[0]
  const b = row0[1]
  const c = row0[2]
  const d = row1[0]
  const e = row1[1]
  const f = row1[2]
  if (
    typeof a !== 'number' || !Number.isFinite(a)
    || typeof b !== 'number' || !Number.isFinite(b)
    || typeof c !== 'number' || !Number.isFinite(c)
    || typeof d !== 'number' || !Number.isFinite(d)
    || typeof e !== 'number' || !Number.isFinite(e)
    || typeof f !== 'number' || !Number.isFinite(f)
  ) return null

  const lng = a * x + b * y + c
  const lat = d * x + e * y + f
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function MapGround({ texture, scale }: { texture: THREE.Texture | null; scale: number }) {
  const meshKey = texture ? 'textured' : 'fallback'
  return (
    <mesh key={meshKey} position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[PLANE_SIZE * scale, PLANE_SIZE * scale]} />
      {texture ? (
        <meshBasicMaterial
          map={texture}
          toneMapped={false}
          side={THREE.DoubleSide}
          fog={false}
        />
      ) : (
        <meshBasicMaterial color="#d9d8d3" side={THREE.DoubleSide} fog={false} />
      )}
    </mesh>
  )
}

function boundsForModel(walls: Wall2D[], rooms: Room2D[]) {
  const xs = [
    ...walls.flatMap((wall) => [wall.x1, wall.x2]),
    ...rooms.flatMap((room) => [room.x, room.x + room.w]),
  ]
  const ys = [
    ...walls.flatMap((wall) => [wall.y1, wall.y2]),
    ...rooms.flatMap((room) => [room.y, room.y + room.h]),
  ]
  if (xs.length === 0 || ys.length === 0) return { cx: 0, cy: 0, span: 16 }
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    span: Math.max(maxX - minX, maxY - minY, 1),
  }
}

function WallMesh({ wall, mapPoint, yOffset, active }: {
  wall: Wall2D
  mapPoint: ProjectPointMapper
  yOffset: number
  active: boolean
}) {
  const start = mapPoint(wall.x1, wall.y1)
  const end = mapPoint(wall.x2, wall.y2)
  const x1 = start.x
  const z1 = start.z
  const x2 = end.x
  const z2 = end.z
  const dx = x2 - x1
  const dz = z2 - z1
  const length = Math.hypot(dx, dz)
  if (length < 0.01) return null
  const angle = Math.atan2(dz, dx)
  return (
    <mesh
      position={[(x1 + x2) / 2, yOffset + 1.45, (z1 + z2) / 2]}
      rotation={[0, -angle, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[length, 2.9, 0.32]} />
      <meshStandardMaterial color={active ? '#e4e4e7' : '#a1a1aa'} roughness={0.78} transparent opacity={active ? 0.94 : 0.42} />
    </mesh>
  )
}

function RoomSlab({ room, mapPoint, fallbackScale, yOffset, active }: {
  room: Room2D
  mapPoint: ProjectPointMapper
  fallbackScale: number
  yOffset: number
  active: boolean
}) {
  const p0 = mapPoint(room.x, room.y)
  const p1 = mapPoint(room.x + room.w, room.y)
  const p2 = mapPoint(room.x + room.w, room.y + room.h)
  const p3 = mapPoint(room.x, room.y + room.h)
  const centerX = (p0.x + p1.x + p2.x + p3.x) / 4
  const centerZ = (p0.z + p1.z + p2.z + p3.z) / 4
  const edgeX = p1.x - p0.x
  const edgeZ = p1.z - p0.z
  const depthX = p2.x - p1.x
  const depthZ = p2.z - p1.z
  const width = Math.max(Math.hypot(edgeX, edgeZ) - 0.24, 0.2, room.w * fallbackScale * 0.2)
  const depth = Math.max(Math.hypot(depthX, depthZ) - 0.24, 0.2, room.h * fallbackScale * 0.2)
  const angle = Math.atan2(edgeZ, edgeX)

  return (
    <mesh
      position={[centerX, yOffset + 0.04, centerZ]}
      rotation={[-Math.PI / 2, 0, angle]}
      receiveShadow
    >
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial color={active ? '#f4f4f5' : '#d4d4d8'} transparent opacity={active ? 0.18 : 0.08} side={THREE.DoubleSide} />
    </mesh>
  )
}

function EditorBuildingModel({
  floors,
  selectedFloorId,
  walls,
  rooms,
  center,
  alignmentMatrix,
}: {
  floors: Floor[]
  selectedFloorId: number | null
  walls: Wall2D[]
  rooms: Room2D[]
  center: LatLngTuple
  alignmentMatrix: number[][] | null
}) {
  const sortedFloors = useMemo(
    () => floors.slice().sort((a, b) => a.floor_number - b.floor_number),
    [floors],
  )
  const renderFloors = sortedFloors.length > 0
    ? sortedFloors
    : Array.from({ length: 3 }, (_, index) => ({
        id: -index - 1,
        floor_number: index + 1,
        floor_name: `${index + 1}F`,
        height_meters: 3,
      } as Floor))

  const bounds = useMemo(() => boundsForModel(walls, rooms), [rooms, walls])
  const modelScale = Math.min(3.2, 42 / bounds.span)
  const hasEditorModel = walls.length > 0 || rooms.length > 0
  const mapPoint = useCallback<ProjectPointMapper>((x, y) => {
    const gps = transformLocalToGps(alignmentMatrix, x, y)
    if (gps) return gpsToScenePoint(gps.lat, gps.lng, center)
    return {
      x: (x - bounds.cx) * modelScale,
      z: (y - bounds.cy) * modelScale,
    }
  }, [alignmentMatrix, bounds.cx, bounds.cy, center, modelScale])

  return (
    <group position={[0, 0.24, 0]} rotation={[0, alignmentMatrix ? 0 : -0.18, 0]}>
      {renderFloors.map((floor, index) => {
        const isSelected = floor.id === selectedFloorId || (selectedFloorId === null && index === 0)
        const height = Math.max(2.6, floor.height_meters ?? 3)
        const yOffset = index * (height + 0.42)
        return (
          <group key={floor.id}>
            {hasEditorModel ? (
              <>
                {rooms.map((room, roomIndex) => (
                  <RoomSlab key={`room-${floor.id}-${roomIndex}`} room={room} mapPoint={mapPoint} fallbackScale={modelScale} yOffset={yOffset} active={isSelected} />
                ))}
                {walls.map((wall, wallIndex) => (
                  <WallMesh key={`wall-${floor.id}-${wallIndex}`} wall={wall} mapPoint={mapPoint} yOffset={yOffset} active={isSelected} />
                ))}
              </>
            ) : (
              <mesh position={[0, yOffset + height / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[45, height, 32]} />
                <meshStandardMaterial color={isSelected ? '#e4e4e7' : '#a1a1aa'} roughness={0.78} transparent opacity={isSelected ? 0.82 : 0.34} />
              </mesh>
            )}
            {isSelected && (
              <Html position={[0, yOffset + height + 1.8, -18]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
                <span className="monitor-3d-label">{floor.floor_name ?? `${floor.floor_number}F`}</span>
              </Html>
            )}
          </group>
        )
      })}
    </group>
  )
}

function DeviceMarker({
  device,
  selected,
  showCoverage,
  onSelect,
  yOffset,
  mapPoint,
}: {
  device: SecurityDevice
  selected: boolean
  showCoverage: boolean
  onSelect: (id: string) => void
  yOffset: number
  mapPoint: ProjectPointMapper
}) {
  const color = deviceColor(device.device_type)
  const position = mapPoint(device.x, device.y)
  const x = position.x
  const z = position.z
  const y = yOffset + 4.2

  const handleClick = useCallback(() => onSelect(device.id), [device.id, onSelect])

  return (
    <group position={[x, y, z]} onClick={handleClick}>
      {showCoverage && device.device_type === 'camera' && (
        <mesh position={[0, -4.85, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
          <circleGeometry args={[selected ? 8.4 : 7.2, 56]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={selected ? 0.18 : 0.1} depthWrite={false} />
        </mesh>
      )}
      <pointLight color={color} intensity={selected ? 1.8 : 0.95} distance={18} />
      <mesh position={[0, -4.7, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.1, selected ? 2.8 : 2.2, 44]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.48 : 0.3} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh castShadow>
        <sphereGeometry args={[selected ? 1.1 : 0.85, 28, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.72 : 0.4} roughness={0.3} />
      </mesh>
      <mesh position={[0, -2.2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 4.8, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.58} />
      </mesh>
      <Html position={[0, 2.4, 0]} center distanceFactor={9} style={{ pointerEvents: 'none' }}>
        <span className={'monitor-3d-device-label' + (selected ? ' selected' : '')}>{device.name}</span>
      </Html>
    </group>
  )
}

function PointCloudHint() {
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array(Array.from({ length: 240 }, (_, i) => {
            const pointIndex = Math.floor(i / 3)
            if (i % 3 === 0) return -46 + ((pointIndex * 19) % 92)
            if (i % 3 === 1) return 0.25 + (pointIndex % 7) * 0.06
            return -32 + ((pointIndex * 31) % 64)
          })), 3]}
        />
      </bufferGeometry>
      <pointsMaterial color="#93c5fd" size={1.0} transparent opacity={0.26} sizeAttenuation />
    </points>
  )
}

function SceneLoader() {
  return (
    <Html center>
      <div className="monitor-3d-loader">Loading OSM map...</div>
    </Html>
  )
}

function MonitorMapScene({
  center,
  floors,
  selectedFloorId,
  walls,
  rooms,
  devices,
  selectedDeviceId,
  showCoverage,
  showGps,
  showPointCloud,
  onSelectDevice,
  mapZoom,
  mapScale,
  alignmentMatrix,
}: Omit<MonitorSpatialViewProps, 'building' | 'mapSettings' | 'alignmentSnapshot'> & {
  center: LatLngTuple
  mapZoom: number
  mapScale: number
  alignmentMatrix: number[][] | null
}) {
  const { texture, isLoading } = useOsmTexture(center, mapZoom)
  const selectedFloorIndex = Math.max(0, floors.findIndex((floor) => floor.id === selectedFloorId))
  const selectedFloor = floors[selectedFloorIndex]
  const selectedFloorHeight = Math.max(2.6, selectedFloor?.height_meters ?? 3)
  const deviceYOffset = selectedFloorIndex * (selectedFloorHeight + 0.42)
  const fallbackBounds = useMemo(() => boundsForModel(walls, rooms), [rooms, walls])
  const fallbackScale = Math.min(3.2, 42 / fallbackBounds.span)
  const mapPoint = useCallback<ProjectPointMapper>((x, y) => {
    const gps = transformLocalToGps(alignmentMatrix, x, y)
    if (gps) return gpsToScenePoint(gps.lat, gps.lng, center)
    return {
      x: (x - fallbackBounds.cx) * fallbackScale,
      z: (y - fallbackBounds.cy) * fallbackScale,
    }
  }, [alignmentMatrix, center, fallbackBounds.cx, fallbackBounds.cy, fallbackScale])

  return (
    <>
      <color attach="background" args={['#2a2a2d']} />
      <fog attach="fog" args={['#2a2a2d', 210, 380]} />
      <ambientLight intensity={0.92} />
      <directionalLight position={[42, 70, 32]} intensity={1.35} castShadow />
      <MapGround texture={texture} scale={mapScale} />
      <EditorBuildingModel
        floors={floors}
        selectedFloorId={selectedFloorId}
        walls={walls}
        rooms={rooms}
        center={center}
        alignmentMatrix={alignmentMatrix}
      />
      {showPointCloud && <PointCloudHint />}
      {showGps && (
        <Html position={[0, 16, -28]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <span className="monitor-3d-label success">GPS Origin</span>
        </Html>
      )}
      {devices.map((device) => (
        <DeviceMarker
          key={device.id}
          device={device}
          selected={device.id === selectedDeviceId}
          showCoverage={showCoverage}
          onSelect={onSelectDevice}
          yOffset={deviceYOffset}
          mapPoint={mapPoint}
        />
      ))}
      {isLoading && <SceneLoader />}
    </>
  )
}

export function MonitorSpatialView({
  building,
  mapSettings,
  alignmentSnapshot,
  floors,
  selectedFloorId,
  walls,
  rooms,
  devices,
  selectedDeviceId,
  showCoverage,
  showGps,
  showPointCloud,
  onSelectDevice,
}: MonitorSpatialViewProps) {
  const center = useMemo<LatLngTuple>(() => {
    if (alignmentSnapshot?.buildingOrigin) {
      return alignmentSnapshot.buildingOrigin
    }
    if (mapSettings) {
      return [mapSettings.origin_latitude, mapSettings.origin_longitude]
    }
    if (building?.origin_latitude != null && building.origin_longitude != null) {
      return [building.origin_latitude, building.origin_longitude]
    }
    return DEFAULT_CENTER
  }, [alignmentSnapshot, building, mapSettings])
  const mapZoom = Math.max(10, Math.min(19, Math.round(alignmentSnapshot?.osmQuadZoom ?? mapSettings?.osm_zoom ?? MAP_ZOOM)))
  const sourceScale = alignmentSnapshot?.osmQuadScale ?? mapSettings?.osm_scale ?? 2
  const mapScale = Math.max(0.6, Math.min(4, sourceScale / 2))
  const alignmentMatrix = alignmentSnapshot?.alignmentMatrix ?? null

  return (
    <div className="monitor-spatial-view" role="img" aria-label="Monitor OSM 3D map view">
      <Canvas
        camera={{ position: [58, 86, 58], fov: 43 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        shadows
      >
        <Suspense fallback={<SceneLoader />}>
          <MonitorMapScene
            center={center}
            floors={floors}
            selectedFloorId={selectedFloorId}
            walls={walls}
            rooms={rooms}
            devices={devices}
            selectedDeviceId={selectedDeviceId}
            showCoverage={showCoverage}
            showGps={showGps}
            showPointCloud={showPointCloud}
            onSelectDevice={onSelectDevice}
            mapZoom={mapZoom}
            mapScale={mapScale}
            alignmentMatrix={alignmentMatrix}
          />
        </Suspense>
        <OrbitControls
          enableDamping
          dampingFactor={0.14}
          minDistance={24}
          maxDistance={170}
          maxPolarAngle={Math.PI / 2.14}
          target={[0, 5, 0]}
          makeDefault
        />
      </Canvas>
      <div className="monitor-3d-coordinate">
        Cesium 3D - {center[0].toFixed(6)}, {center[1].toFixed(6)} / z{mapZoom}
      </div>
    </div>
  )
}
