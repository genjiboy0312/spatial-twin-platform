import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

import type { Building } from '../../../api/buildings'
import type { Floor } from '../../../api/floors'
import type { SecurityDevice } from '../../../stores/editorStore'

export interface MonitorSpatialViewProps {
  building: Building | null
  floors: Floor[]
  selectedFloorId: number | null
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

function MapGround({ texture }: { texture: THREE.Texture | null }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[PLANE_SIZE, PLANE_SIZE]} />
      {texture ? (
        <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} />
      ) : (
        <meshBasicMaterial color="#d9d8d3" side={THREE.DoubleSide} />
      )}
    </mesh>
  )
}

function FloorStack({ floors, selectedFloorId }: { floors: Floor[]; selectedFloorId: number | null }) {
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

  return (
    <group position={[0, 0.18, 0]} rotation={[0, -0.18, 0]}>
      {renderFloors.map((floor, index) => {
        const isSelected = floor.id === selectedFloorId || (selectedFloorId === null && index === 0)
        const height = Math.max(2.4, floor.height_meters ?? 3)
        const y = index * (height + 0.28) + height / 2
        const opacity = isSelected ? 0.92 : 0.5
        return (
          <group key={floor.id} position={[0, y, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[45, height, 32]} />
              <meshStandardMaterial
                color={isSelected ? '#e4e4e7' : '#a1a1aa'}
                metalness={0.05}
                roughness={0.78}
                transparent
                opacity={opacity}
              />
            </mesh>
            <mesh position={[0, height / 2 + 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[42, 29]} />
              <meshBasicMaterial color={isSelected ? '#f8fafc' : '#d4d4d8'} transparent opacity={isSelected ? 0.22 : 0.1} />
            </mesh>
            {isSelected && (
              <Html position={[0, height / 2 + 2.8, -18]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
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
}: {
  device: SecurityDevice
  selected: boolean
  showCoverage: boolean
  onSelect: (id: string) => void
}) {
  const color = deviceColor(device.device_type)
  const x = (device.x - 8) * 2.6
  const z = (device.y - 7) * 2.2
  const y = 5.2

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
  devices,
  selectedDeviceId,
  showCoverage,
  showGps,
  showPointCloud,
  onSelectDevice,
}: Omit<MonitorSpatialViewProps, 'building'> & { center: LatLngTuple }) {
  const { texture, isLoading } = useOsmTexture(center, MAP_ZOOM)

  return (
    <>
      <color attach="background" args={['#2a2a2d']} />
      <fog attach="fog" args={['#2a2a2d', 210, 380]} />
      <ambientLight intensity={0.92} />
      <directionalLight position={[42, 70, 32]} intensity={1.35} castShadow />
      <MapGround texture={texture} />
      <FloorStack floors={floors} selectedFloorId={selectedFloorId} />
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
        />
      ))}
      {isLoading && <SceneLoader />}
    </>
  )
}

export function MonitorSpatialView({
  building,
  floors,
  selectedFloorId,
  devices,
  selectedDeviceId,
  showCoverage,
  showGps,
  showPointCloud,
  onSelectDevice,
}: MonitorSpatialViewProps) {
  const center = useMemo<LatLngTuple>(() => {
    if (building?.origin_latitude != null && building.origin_longitude != null) {
      return [building.origin_latitude, building.origin_longitude]
    }
    return DEFAULT_CENTER
  }, [building])

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
            devices={devices}
            selectedDeviceId={selectedDeviceId}
            showCoverage={showCoverage}
            showGps={showGps}
            showPointCloud={showPointCloud}
            onSelectDevice={onSelectDevice}
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
        Cesium 3D - {center[0].toFixed(6)}, {center[1].toFixed(6)} / z{MAP_ZOOM}
      </div>
    </div>
  )
}
