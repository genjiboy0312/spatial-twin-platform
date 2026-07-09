import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

type LatLngTuple = [number, number]

type AlignmentMarker = {
  id: string
  latitude: number
  longitude: number
  label: string
  tone?: 'origin' | 'point1' | 'point2' | 'picked'
}

interface Alignment3DViewerProps {
  center?: LatLngTuple | undefined
  zoom?: number
  markers?: AlignmentMarker[]
  pickLabel?: string | undefined
  instruction?: string | undefined
  readOnly?: boolean
  cameraViewMode?: 'top' | 'perspective'
  onPick?: ((latitude: number, longitude: number) => void) | undefined
  onViewChange?: ((center: LatLngTuple, zoom: number) => void) | undefined
}

const TILE_URL = '/api/osm-tiles/{z}/{x}/{y}.png'
const DEFAULT_CENTER: LatLngTuple = [37.5665, 126.9784]
const TILE_SIZE = 256
const TILE_GRID_SIZE = 4
const TEXTURE_SIZE = TILE_SIZE * TILE_GRID_SIZE
const PLANE_SIZE = 400
const METERS_PER_DEGREE = 111_320
const MIN_ZOOM = 10
const MAX_ZOOM = 18

const markerColors = {
  origin: '#facc15',
  point1: '#7c3aed',
  point2: '#38bdf8',
  picked: '#22c55e',
} satisfies Record<NonNullable<AlignmentMarker['tone']>, string>

function clampZoom(zoom: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(zoom)))
}

function safeCosLatitude(latitude: number) {
  const value = Math.cos((latitude * Math.PI) / 180)
  return Math.abs(value) < 1e-6 ? 1e-6 : value
}

function latLngToWorldPixel(latitude: number, longitude: number, zoom: number) {
  const clippedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude))
  const sinLat = Math.sin((clippedLatitude * Math.PI) / 180)
  const scale = TILE_SIZE * 2 ** zoom
  return {
    wx: ((longitude + 180) / 360) * scale,
    wy: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  }
}

function localPositionToGps(x: number, z: number, center: LatLngTuple): LatLngTuple {
  const [centerLat, centerLng] = center
  return [
    centerLat + z / METERS_PER_DEGREE,
    centerLng + x / (METERS_PER_DEGREE * safeCosLatitude(centerLat)),
  ]
}

function gpsToLocalPosition(latitude: number, longitude: number, center: LatLngTuple): [number, number, number] {
  const [centerLat, centerLng] = center
  return [
    (longitude - centerLng) * METERS_PER_DEGREE * safeCosLatitude(centerLat),
    0,
    (latitude - centerLat) * METERS_PER_DEGREE,
  ]
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
  ctx.fillStyle = '#d8d6d0'
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)

  ctx.fillStyle = '#b8c697'
  ctx.beginPath()
  ctx.moveTo(-40, 130)
  ctx.lineTo(260, 60)
  ctx.lineTo(TEXTURE_SIZE + 40, 118)
  ctx.lineTo(TEXTURE_SIZE + 40, 178)
  ctx.lineTo(260, 126)
  ctx.lineTo(-40, 204)
  ctx.closePath()
  ctx.fill()

  const roads = [
    { y: 210, width: 54, color: '#b8b8b8' },
    { y: 360, width: 68, color: '#c5c1bc' },
    { y: 540, width: 48, color: '#b4b4b4' },
  ]
  for (const road of roads) {
    ctx.save()
    ctx.translate(TEXTURE_SIZE / 2, road.y)
    ctx.rotate(-0.08)
    ctx.fillStyle = road.color
    ctx.fillRect(-TEXTURE_SIZE, -road.width / 2, TEXTURE_SIZE * 2, road.width)
    ctx.restore()
  }

  ctx.strokeStyle = 'rgba(239, 68, 68, 0.42)'
  ctx.setLineDash([8, 9])
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(90, 120)
  ctx.bezierCurveTo(260, 220, 420, 270, 650, 300)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.strokeStyle = 'rgba(59, 130, 246, 0.42)'
  ctx.lineWidth = 4
  ctx.strokeRect(72, 84, 150, 92)
  ctx.strokeRect(516, 98, 126, 76)
  ctx.strokeRect(152, 516, 190, 96)

  ctx.fillStyle = 'rgba(148, 163, 184, 0.16)'
  for (let i = 0; i < 26; i += 1) {
    const x = 54 + ((i * 83) % 650)
    const y = 58 + ((i * 137) % 620)
    ctx.fillRect(x, y, 18 + (i % 4) * 9, 8 + (i % 3) * 8)
  }
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

    const { wx, wy } = latLngToWorldPixel(center[0], center[1], zoom)
    const startTileX = Math.floor(wx / TILE_SIZE) - 1
    const startTileY = Math.floor(wy / TILE_SIZE) - 1
    const tileCount = 2 ** zoom

    // Start with transparent canvas — only real tiles will be drawn
    ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
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
            .catch((err) => {
              if (cancelled) return
              console.warn('[OSM] Tile load failed:', tileUrl(zoom, wrappedX, rawY), err)
              // Leave failed tiles transparent — no fallback fill
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

function GroundPlane({
  center,
  readOnly,
  texture,
  onPick,
}: {
  center: LatLngTuple
  readOnly: boolean
  texture: THREE.Texture | null
  onPick?: ((latitude: number, longitude: number) => void) | undefined
}) {
  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (readOnly || !onPick) return
    event.stopPropagation()
    const [latitude, longitude] = localPositionToGps(event.point.x, event.point.z, center)
    onPick(latitude, longitude)
  }, [center, onPick, readOnly])

  // Key forces remount when texture changes, ensuring material picks up updates
  const meshKey = texture ? 'textured' : 'fallback'

  return (
    <mesh
      key={meshKey}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onPointerDown={handlePointerDown}
    >
      <planeGeometry args={[PLANE_SIZE, PLANE_SIZE]} />
      {texture ? (
        <meshBasicMaterial
          map={texture}
          toneMapped={false}
          side={THREE.DoubleSide}
          fog={false}
          transparent
          opacity={1}
        />
      ) : (
        <meshBasicMaterial transparent opacity={0} />
      )}
    </mesh>
  )
}

function CameraRig({ cameraViewMode }: { cameraViewMode: 'top' | 'perspective' }) {
  const { camera } = useThree()

  useEffect(() => {
    if (cameraViewMode === 'top') {
      camera.position.set(0, 92, 0.001)
      camera.up.set(0, 0, -1)
    } else {
      camera.position.set(38, 82, 38)
      camera.up.set(0, 1, 0)
    }
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, cameraViewMode])

  return null
}

function DemoBuildingModel() {
  const walls = [
    { position: [0, 0.42, -21], scale: [42, 0.84, 1.4] },
    { position: [0, 0.42, 21], scale: [42, 0.84, 1.4] },
    { position: [-21, 0.42, 0], scale: [1.4, 0.84, 42] },
    { position: [21, 0.42, 0], scale: [1.4, 0.84, 42] },
    { position: [-5, 0.42, 0], scale: [1.2, 0.84, 23] },
    { position: [9, 0.42, -8], scale: [18, 0.84, 1.2] },
  ] satisfies Array<{ position: [number, number, number]; scale: [number, number, number] }>
  const blocks = [
    [-11, 1.6, 9, 3.5, 3.2, 4.2],
    [1, 1.8, 4, 4.8, 3.6, 3.6],
    [11, 1.2, 7, 2.8, 2.4, 5.2],
    [7, 1.3, -13, 7, 2.6, 2.2],
    [-12, 1.1, -9, 3, 2.2, 8],
    [17, 1.1, -3, 2.5, 2.2, 6],
  ] satisfies Array<[number, number, number, number, number, number]>

  return (
    <group position={[0, 0.04, 0]}>
      {walls.map((wall, index) => (
        <mesh key={`wall-${index}`} position={wall.position} scale={wall.scale} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#a8a8a3" roughness={0.76} transparent opacity={0.92} />
        </mesh>
      ))}
      {blocks.map(([x, y, z, sx, sy, sz], index) => (
        <mesh key={`block-${index}`} position={[x, y, z]} scale={[sx, sy, sz]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#b5b5b0" roughness={0.72} transparent opacity={0.92} />
        </mesh>
      ))}
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.4, 7.4, 48]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.22} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function AlignmentMarkerObject({ marker, center }: { marker: AlignmentMarker; center: LatLngTuple }) {
  const position = useMemo(() => gpsToLocalPosition(marker.latitude, marker.longitude, center), [center, marker.latitude, marker.longitude])
  const color = markerColors[marker.tone ?? 'picked']

  return (
    <group position={position}>
      <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.3, 2.1, 56]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.72, 32, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} roughness={0.28} />
      </mesh>
      <Html position={[0, 2.25, 0]} center distanceFactor={13} style={{ pointerEvents: 'none' }}>
        <span className="alignment-3d-label">
          {marker.label}
        </span>
      </Html>
    </group>
  )
}

function AxisGizmo() {
  return (
    <group position={[42, 2.4, 34]} scale={1.4}>
      <mesh>
        <sphereGeometry args={[1.6, 28, 16]} />
        <meshStandardMaterial color="#181820" roughness={0.5} metalness={0.05} />
      </mesh>
      <mesh position={[1.8, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.28, 1.4, 16]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0, 1.8, 0]}>
        <coneGeometry args={[0.28, 1.4, 16]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
      <mesh position={[0, 0, 1.8]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.28, 1.4, 16]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>
    </group>
  )
}

function SceneLoader() {
  return (
    <Html center>
      <div className="alignment-3d-loader">Loading map...</div>
    </Html>
  )
}

function AlignmentScene({
  center,
  markers,
  readOnly,
  zoom,
  onPick,
}: {
  center: LatLngTuple
  markers: AlignmentMarker[]
  readOnly: boolean
  zoom: number
  onPick?: ((latitude: number, longitude: number) => void) | undefined
}) {
  const { texture, isLoading } = useOsmTexture(center, zoom)

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[18, 26, 14]} intensity={1.2} castShadow />
      <GroundPlane center={center} texture={texture} readOnly={readOnly} onPick={onPick} />
      <DemoBuildingModel />
      {isLoading && <SceneLoader />}
      {markers.map((marker) => <AlignmentMarkerObject key={marker.id} marker={marker} center={center} />)}
      <AxisGizmo />
    </>
  )
}

export function Alignment3DViewer({
  center,
  zoom = 17,
  markers = [],
  pickLabel,
  instruction,
  readOnly = false,
  cameraViewMode = 'perspective',
  onPick,
  onViewChange,
}: Alignment3DViewerProps) {
  const viewerCenter = center ?? DEFAULT_CENTER
  const mapZoom = clampZoom(zoom)

  useEffect(() => {
    onViewChange?.(viewerCenter, mapZoom)
  }, [mapZoom, onViewChange, viewerCenter])

  return (
    <div className="alignment-3d-viewer">
      <Canvas
        camera={cameraViewMode === 'top' ? { position: [0, 86, 0.01], fov: 42 } : { position: [38, 82, 38], fov: 44 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}
        shadows
      >
        <CameraRig cameraViewMode={cameraViewMode} />
        <color attach="background" args={['#2a2a2d']} />
        <fog attach="fog" args={['#2a2a2d', 180, 340]} />
        <Suspense fallback={<SceneLoader />}>
          <AlignmentScene center={viewerCenter} zoom={mapZoom} markers={markers} readOnly={readOnly} onPick={onPick} />
        </Suspense>
        <OrbitControls
          enableDamping
          dampingFactor={0.14}
          enableRotate={cameraViewMode !== 'top'}
          minDistance={10}
          maxDistance={140}
          maxPolarAngle={Math.PI / 2.18}
          target={[0, 0, 0]}
          makeDefault
        />
      </Canvas>
      <div className="alignment-3d-coordinate">
        Cesium 3D - {viewerCenter[0].toFixed(6)}, {viewerCenter[1].toFixed(6)}
      </div>
      <div className="alignment-3d-footer">
        <span>{pickLabel ?? '3D OSM Viewer'}</span>
        <span>{viewerCenter[0].toFixed(6)}, {viewerCenter[1].toFixed(6)} / z{mapZoom}</span>
      </div>
      {instruction && <p className="alignment-3d-instruction">{instruction}</p>}
    </div>
  )
}