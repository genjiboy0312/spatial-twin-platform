import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { AxisIndicator3D } from './AxisIndicator3D'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Wall2D, Room2D, WallOpening2D } from './Canvas2DViewer'
import type { EditorVisibleLayers, SecurityDevice } from '../stores/editorStore'
import type { LayerId } from '../stores/layerStore'
import { DEVICE_COLORS } from '../constants/devices'
import type { UploadAsset } from '../api/uploads'

type Props = {
  walls?: Wall2D[]
  rooms?: Room2D[]
  openings?: WallOpening2D[]
  devices?: SecurityDevice[]
  selectedDeviceIdx?: number | null
  selectedWallIdx?: number | null
  selectedRoomIdx?: number | null
  selectedOpeningIdx?: number | null
  onSelectWall?: ((idx: number) => void) | undefined
  onSelectRoom?: ((idx: number) => void) | undefined
  onSelectOpening?: ((idx: number) => void) | undefined
  onSelectDevice?: ((idx: number) => void) | undefined
  onSelectEmpty?: (() => void) | undefined
  viewMode?: '2d' | '3d'
  pointClouds?: UploadAsset[]
  showAxisGizmo?: boolean
  visibleLayers?: EditorVisibleLayers
  layerVisibility?: Partial<Record<LayerId, boolean>>
  layerOpacity?: Partial<Record<LayerId, number>>
}

const FLOOR_HEIGHT = 0.15
const WALL_HEIGHT = 3
const WALL_DEPTH = 0.1
const DOOR_OPENING_HEIGHT = 2.12
const WINDOW_SILL_HEIGHT = 1.02
const WINDOW_OPENING_HEIGHT = 1.02
const PASS_OPENING_BOTTOM = 0.52
const PASS_OPENING_HEIGHT = 1.55
const POINTCLOUD_MAX_POINTS = 2_000_000
const POINTCLOUD_FAST_PREVIEW_POINTS = 100_000
const DEFAULT_VISIBLE_LAYERS: EditorVisibleLayers = {
  walls: true,
  rooms: true,
  devices: true,
  openings: true,
  grid: true,
  floorPlan: true,
  coverage: false,
  heatmap: false,
  pathway: false,
}

type ParsedPointCloud = {
  positions: Float32Array
  colors: Float32Array
  count: number
}

function normalizeColorValue(value: number) {
  return Math.max(0, Math.min(1, value > 255 ? value / 65535 : value / 255))
}

function lasRgbOffset(pointFormat: number, pointRecordLength: number) {
  if (pointFormat === 2 && pointRecordLength >= 26) return 20
  if ([3, 5].includes(pointFormat) && pointRecordLength >= 34) return 28
  if ([7, 8, 10].includes(pointFormat) && pointRecordLength >= 36) return 30
  return null
}

function pointBudgetForAsset(index: number, totalAssets: number) {
  if (totalAssets <= 0) return 0
  const base = Math.floor(POINTCLOUD_MAX_POINTS / totalAssets)
  const remainder = POINTCLOUD_MAX_POINTS % totalAssets
  return base + (index < remainder ? 1 : 0)
}

function setScenePointer(active: boolean) {
  document.body.style.cursor = active ? 'pointer' : ''
}

function WallSegmentMesh({
  centerX,
  centerZ,
  length,
  height,
  y,
  angle,
  selected,
  opacity = 1,
  onSelect,
}: {
  centerX: number
  centerZ: number
  length: number
  height: number
  y: number
  angle: number
  selected?: boolean | undefined
  opacity?: number
  onSelect?: (() => void) | undefined
}) {
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null)

  useEffect(() => {
    const material = materialRef.current
    if (!material) return
    material.opacity = Math.max(0, Math.min(1, opacity))
    material.transparent = false
    material.alphaHash = opacity < 0.99
    material.depthWrite = true
    material.needsUpdate = true
  }, [opacity])

  if (length < 0.02 || height < 0.02) return null
  return (
    <mesh
      position={[centerX, y, centerZ]}
      rotation={[0, -angle, 0]}
      onPointerDown={(event) => {
        event.stopPropagation()
        onSelect?.()
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        setScenePointer(true)
      }}
      onPointerOut={() => setScenePointer(false)}
    >
      <boxGeometry args={[length, height, WALL_DEPTH]} />
      <meshStandardMaterial
        ref={materialRef}
        color={selected ? '#38bdf8' : '#90a4ae'}
        emissive={selected ? '#075985' : '#000000'}
        emissiveIntensity={selected ? 0.32 : 0}
        roughness={0.8}
        transparent={false}
        alphaHash={opacity < 0.99}
        opacity={opacity}
        depthWrite
      />
    </mesh>
  )
}

function remainingWallBands(type: WallOpening2D['type']) {
  if (type === 'door') {
    return [{ bottom: DOOR_OPENING_HEIGHT, top: WALL_HEIGHT }]
  }
  if (type === 'window') {
    return [
      { bottom: 0, top: WINDOW_SILL_HEIGHT },
      { bottom: WINDOW_SILL_HEIGHT + WINDOW_OPENING_HEIGHT, top: WALL_HEIGHT },
    ]
  }
  return [
    { bottom: 0, top: PASS_OPENING_BOTTOM },
    { bottom: PASS_OPENING_BOTTOM + PASS_OPENING_HEIGHT, top: WALL_HEIGHT },
  ]
}

function WallMesh({ wall, openings = [], selected, opacity = 1, onSelect }: { wall: Wall2D; openings?: WallOpening2D[]; selected?: boolean; opacity?: number; onSelect?: (() => void) | undefined }) {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const length = Math.sqrt(dx * dx + dy * dy)
  if (length < 0.01) return null
  const angle = Math.atan2(dy, dx)
  const ux = dx / length
  const uy = dy / length
  const rawCuts = openings
    .map((opening) => {
      const width = Math.max(0.2, Math.min(opening.width, length))
      const center = opening.position * length
      return {
        ...opening,
        start: Math.max(0, center - width / 2),
        end: Math.min(length, center + width / 2),
      }
    })
    .filter((opening) => opening.end - opening.start > 0.05)
    .sort((a, b) => a.start - b.start)

  const cuts: typeof rawCuts = []
  for (const cut of rawCuts) {
    const last = cuts[cuts.length - 1]
    if (last && cut.start <= last.end) {
      last.end = Math.max(last.end, cut.end)
    } else {
      cuts.push({ ...cut })
    }
  }

  const wallPieces: Array<{ start: number; end: number; height?: number; y?: number }> = []
  let cursor = 0
  for (const cut of cuts) {
    if (cut.start > cursor) wallPieces.push({ start: cursor, end: cut.start })
    cursor = Math.max(cursor, cut.end)

    for (const band of remainingWallBands(cut.type)) {
      const height = Math.max(0, band.top - band.bottom)
      if (height > 0.04) {
        wallPieces.push({
          start: cut.start,
          end: cut.end,
          height,
          y: band.bottom + height / 2,
        })
      }
    }
  }
  if (cursor < length) wallPieces.push({ start: cursor, end: length })

  return (
    <group>
      {wallPieces.map((piece, index) => {
        const segmentLength = piece.end - piece.start
        const midpoint = (piece.start + piece.end) / 2
        const centerX = wall.x1 + ux * midpoint
        const centerZ = wall.y1 + uy * midpoint
        return (
          <WallSegmentMesh
            key={`${piece.start}-${piece.end}-${index}`}
            centerX={centerX}
            centerZ={centerZ}
            length={segmentLength}
            height={piece.height ?? WALL_HEIGHT}
            y={piece.y ?? WALL_HEIGHT / 2}
            angle={angle}
            selected={selected}
            opacity={opacity}
            onSelect={onSelect}
          />
        )
      })}
    </group>
  )
}

function openingLayerId(type: WallOpening2D['type']): LayerId {
  if (type === 'door') return 'doors'
  if (type === 'window') return 'windows'
  return 'passages'
}

function OpeningMesh({ opening, wall, selected, opacity = 1, onSelect }: { opening: WallOpening2D; wall: Wall2D; selected?: boolean; opacity?: number; onSelect?: (() => void) | undefined }) {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const wallLength = Math.hypot(dx, dy)
  if (wallLength < 0.01) return null

  const angle = Math.atan2(dy, dx)
  const normalX = -dy / wallLength
  const normalZ = dx / wallLength
  const faceOffset = WALL_DEPTH / 2 + 0.01
  const cx = wall.x1 + dx * opening.position + normalX * faceOffset
  const cz = wall.y1 + dy * opening.position + normalZ * faceOffset
  const width = Math.max(0.25, Math.min(opening.width, wallLength))
  const depth = WALL_DEPTH
  const frameDepth = WALL_DEPTH + 0.035

  if (opening.type === 'door') {
    const frameColor = selected ? '#38bdf8' : '#8b5a2b'
    return (
      <group
        position={[cx, DOOR_OPENING_HEIGHT / 2, cz]}
        rotation={[0, -angle, 0]}
        onPointerDown={(event) => {
          event.stopPropagation()
          onSelect?.()
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          setScenePointer(true)
        }}
        onPointerOut={() => setScenePointer(false)}
      >
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[width * 0.84, DOOR_OPENING_HEIGHT - 0.22, 0.075]} />
          <meshStandardMaterial color="#6f4523" roughness={0.55} metalness={0.08} transparent={opacity < 1} opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.03, depth / 2 + 0.018]}>
          <boxGeometry args={[width * 0.68, DOOR_OPENING_HEIGHT - 0.58, 0.028]} />
          <meshStandardMaterial color="#9a6738" roughness={0.46} transparent={opacity < 1} opacity={opacity} />
        </mesh>
        <mesh position={[-width / 2, 0, 0]}>
          <boxGeometry args={[0.07, DOOR_OPENING_HEIGHT, frameDepth]} />
          <meshStandardMaterial color={frameColor} roughness={0.42} transparent={opacity < 1} opacity={opacity} />
        </mesh>
        <mesh position={[width / 2, 0, 0]}>
          <boxGeometry args={[0.07, DOOR_OPENING_HEIGHT, frameDepth]} />
          <meshStandardMaterial color={frameColor} roughness={0.42} transparent={opacity < 1} opacity={opacity} />
        </mesh>
        <mesh position={[0, DOOR_OPENING_HEIGHT / 2, 0]}>
          <boxGeometry args={[width + 0.1, 0.08, frameDepth]} />
          <meshStandardMaterial color={frameColor} roughness={0.42} transparent={opacity < 1} opacity={opacity} />
        </mesh>
        <mesh position={[width * 0.26, 0.02, depth / 2 + 0.06]}>
          <sphereGeometry args={[0.045, 16, 12]} />
          <meshStandardMaterial color="#facc15" emissive="#b45309" emissiveIntensity={0.22} metalness={0.35} roughness={0.25} transparent={opacity < 1} opacity={opacity} />
        </mesh>
      </group>
    )
  }

  if (opening.type === 'window') {
    const frameColor = selected ? '#38bdf8' : '#7dd3fc'
    return (
      <group
        position={[cx, WINDOW_SILL_HEIGHT + WINDOW_OPENING_HEIGHT / 2, cz]}
        rotation={[0, -angle, 0]}
        onPointerDown={(event) => {
          event.stopPropagation()
          onSelect?.()
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          setScenePointer(true)
        }}
        onPointerOut={() => setScenePointer(false)}
      >
        <mesh>
          <boxGeometry args={[width, WINDOW_OPENING_HEIGHT - 0.12, 0.035]} />
          <meshPhysicalMaterial
            color="#7dd3fc"
            transmission={0.62}
            transparent
            opacity={0.28 * opacity}
            roughness={0.08}
            metalness={0}
            thickness={0.08}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[-width / 2, 0, 0.025]}>
          <boxGeometry args={[0.045, WINDOW_OPENING_HEIGHT, WALL_DEPTH]} />
          <meshStandardMaterial color={frameColor} emissive="#0284c7" emissiveIntensity={0.2} roughness={0.28} transparent={opacity < 1} opacity={opacity} />
        </mesh>
        <mesh position={[width / 2, 0, 0.025]}>
          <boxGeometry args={[0.045, WINDOW_OPENING_HEIGHT, WALL_DEPTH]} />
          <meshStandardMaterial color={frameColor} emissive="#0284c7" emissiveIntensity={0.2} roughness={0.28} transparent={opacity < 1} opacity={opacity} />
        </mesh>
        <mesh position={[0, WINDOW_OPENING_HEIGHT / 2, 0.025]}>
          <boxGeometry args={[width + 0.07, 0.045, WALL_DEPTH]} />
          <meshStandardMaterial color={frameColor} emissive="#0284c7" emissiveIntensity={0.2} roughness={0.28} transparent={opacity < 1} opacity={opacity} />
        </mesh>
        <mesh position={[0, -WINDOW_OPENING_HEIGHT / 2, 0.025]}>
          <boxGeometry args={[width + 0.07, 0.045, WALL_DEPTH]} />
          <meshStandardMaterial color={frameColor} emissive="#0284c7" emissiveIntensity={0.2} roughness={0.28} transparent={opacity < 1} opacity={opacity} />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <boxGeometry args={[0.03, WINDOW_OPENING_HEIGHT - 0.14, WALL_DEPTH * 0.85]} />
          <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={0.18} roughness={0.22} transparent={opacity < 1} opacity={opacity} />
        </mesh>
      </group>
    )
  }

  return (
    <group
      position={[cx, PASS_OPENING_BOTTOM + PASS_OPENING_HEIGHT / 2, cz]}
      rotation={[0, -angle, 0]}
      onPointerDown={(event) => {
        event.stopPropagation()
        onSelect?.()
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        setScenePointer(true)
      }}
      onPointerOut={() => setScenePointer(false)}
    >
      <mesh position={[-width / 2, 0, 0]}>
        <boxGeometry args={[0.055, PASS_OPENING_HEIGHT, frameDepth]} />
        <meshStandardMaterial color="#facc15" emissive="#ca8a04" emissiveIntensity={0.16} roughness={0.32} transparent={opacity < 1} opacity={opacity} />
      </mesh>
      <mesh position={[width / 2, 0, 0]}>
        <boxGeometry args={[0.055, PASS_OPENING_HEIGHT, frameDepth]} />
        <meshStandardMaterial color="#facc15" emissive="#ca8a04" emissiveIntensity={0.16} roughness={0.32} transparent={opacity < 1} opacity={opacity} />
      </mesh>
      <mesh position={[0, PASS_OPENING_HEIGHT / 2, 0]}>
        <boxGeometry args={[width + 0.07, 0.055, frameDepth]} />
        <meshStandardMaterial color="#facc15" emissive="#ca8a04" emissiveIntensity={0.16} roughness={0.32} transparent={opacity < 1} opacity={opacity} />
      </mesh>
      <mesh position={[0, -PASS_OPENING_HEIGHT / 2, 0]}>
        <boxGeometry args={[width + 0.07, 0.055, frameDepth]} />
        <meshStandardMaterial color="#facc15" emissive="#ca8a04" emissiveIntensity={0.16} roughness={0.32} transparent={opacity < 1} opacity={opacity} />
      </mesh>
      <mesh position={[0, 0, depth / 2 + 0.012]}>
        <boxGeometry args={[width * 0.82, 0.035, 0.035]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.78 * opacity} />
      </mesh>
    </group>
  )
}

function RoomFloorMesh({ room, opacity = 1 }: { room: Room2D; opacity?: number }) {
  const geometry = useMemo(() => {
    if (room.points && room.points.length >= 3) {
      const shape = new THREE.Shape()
      room.points.forEach((point, index) => {
        if (index === 0) shape.moveTo(point.x, point.y)
        else shape.lineTo(point.x, point.y)
      })
      shape.closePath()
      return new THREE.ShapeGeometry(shape)
    }
    return new THREE.PlaneGeometry(Math.max(0.05, room.w), Math.max(0.05, room.h))
  }, [room.h, room.points, room.w])

  if (room.points && room.points.length >= 3) {
    return (
      <mesh geometry={geometry} position={[0, 0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color="#6b7280"
          roughness={0.84}
          metalness={0.02}
          side={THREE.DoubleSide}
          transparent={opacity < 1}
          opacity={opacity}
          depthWrite={opacity >= 0.99}
        />
      </mesh>
    )
  }

  return (
    <mesh geometry={geometry} position={[room.x + room.w / 2, 0.004, room.y + room.h / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        color="#6b7280"
        roughness={0.84}
        metalness={0.02}
        side={THREE.DoubleSide}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 0.99}
      />
    </mesh>
  )
}

function FloorMesh({ rooms, opacity = 1 }: { rooms: Room2D[]; opacity?: number }) {
  if (rooms.length === 0) return null
  return (
    <group>
      {rooms.map((room, index) => (
        <RoomFloorMesh key={`${room.label ?? 'room'}-${index}`} room={room} opacity={opacity} />
      ))}
    </group>
  )
}

function RoomArea({ room, selected, opacity = 1, onSelect }: { room: Room2D; selected?: boolean; opacity?: number; onSelect?: (() => void) | undefined }) {
  const { x, y, w, h, points } = room
  const geometry = useMemo(() => {
    if (!points || points.length < 3) return null
    const shape = new THREE.Shape()
    points.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, point.y)
      else shape.lineTo(point.x, point.y)
    })
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [points])

  if (geometry) {
    return (
      <mesh
        geometry={geometry}
        position={[0, 0.025, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        onPointerDown={(event) => {
          event.stopPropagation()
          onSelect?.()
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          setScenePointer(true)
        }}
        onPointerOut={() => setScenePointer(false)}
      >
        <meshStandardMaterial
          color={selected ? '#38bdf8' : '#6b7280'}
          transparent
          opacity={(selected ? 0.34 : 0.18) * opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    )
  }

  return (
    <mesh
      position={[x + w / 2, 0.025, y + h / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={(event) => {
        event.stopPropagation()
        onSelect?.()
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        setScenePointer(true)
      }}
      onPointerOut={() => setScenePointer(false)}
    >
      <planeGeometry args={[w - 0.3, h - 0.3]} />
      <meshStandardMaterial
        color={selected ? '#38bdf8' : '#6b7280'}
        transparent
        opacity={(selected ? 0.32 : 0.16) * opacity}
        side={2}
        depthWrite={false}
      />
    </mesh>
  )
}

function DeviceMarker({ device, selected, opacity = 1, onSelect }: { device: SecurityDevice; selected?: boolean; opacity?: number; onSelect?: (() => void) | undefined }) {
  const color = DEVICE_COLORS[device.device_type] || '#94a3b8'
  const isSelected = selected === true
  const finalColor = isSelected ? '#facc15' : color
  const angle = ((device.angle ?? 0) * Math.PI) / 180

  const renderMarkerMaterial = () => (
    <meshStandardMaterial
      color={finalColor}
      emissive={finalColor}
      emissiveIntensity={isSelected ? 0.65 : 0.28}
      metalness={0.28}
      roughness={0.32}
      transparent={opacity < 1}
      opacity={opacity}
      depthWrite={opacity >= 0.99}
    />
  )

  const renderGeometry = () => {
    switch (device.device_type) {
      case 'camera':
        return (
          <group>
            <mesh position={[0, 0.14, 0]}>
              <cylinderGeometry args={[0.08, 0.12, 0.24, 24]} />
              {renderMarkerMaterial()}
            </mesh>
            <mesh position={[0, 0.34, 0]}>
              <boxGeometry args={[0.42, 0.22, 0.28]} />
              {renderMarkerMaterial()}
            </mesh>
            <mesh position={[0, 0.34, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.1, 0.13, 0.18, 24]} />
              <meshStandardMaterial color="#05070a" metalness={0.7} roughness={0.18} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 0.99} />
            </mesh>
            <mesh position={[0, 0.34, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.12, 24]} />
              <meshBasicMaterial color={finalColor} transparent opacity={0.5 * opacity} depthWrite={false} />
            </mesh>
          </group>
        )
      case 'sensor':
        return (
          <group>
            <mesh position={[0, 0.12, 0]}>
              <cylinderGeometry args={[0.16, 0.2, 0.18, 28]} />
              {renderMarkerMaterial()}
            </mesh>
            <mesh position={[0, 0.3, 0]}>
              <sphereGeometry args={[0.18, 24, 16]} />
              {renderMarkerMaterial()}
            </mesh>
            <mesh position={[0, 0.31, 0.01]}>
              <sphereGeometry args={[0.055, 16, 16]} />
              <meshStandardMaterial color="#f8fafc" emissive={finalColor} emissiveIntensity={1.2 * opacity} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 0.99} />
            </mesh>
          </group>
        )
      case 'alarm':
        return (
          <group>
            <mesh position={[0, 0.11, 0]}>
              <cylinderGeometry args={[0.18, 0.2, 0.16, 28]} />
              {renderMarkerMaterial()}
            </mesh>
            <mesh position={[0, 0.27, 0]}>
              <cylinderGeometry args={[0.12, 0.18, 0.2, 28]} />
              <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={(isSelected ? 0.9 : 0.45) * opacity} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 0.99} />
            </mesh>
            <mesh position={[0, 0.42, 0]}>
              <sphereGeometry args={[0.08, 18, 18]} />
              <meshStandardMaterial color="#fee2e2" emissive="#ef4444" emissiveIntensity={1.1 * opacity} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 0.99} />
            </mesh>
          </group>
        )
      case 'access':
        return (
          <group>
            <mesh position={[0, 0.25, 0]}>
              <boxGeometry args={[0.28, 0.48, 0.08]} />
              {renderMarkerMaterial()}
            </mesh>
            <mesh position={[0, 0.31, 0.055]}>
              <boxGeometry args={[0.18, 0.1, 0.018]} />
              <meshStandardMaterial color="#05070a" metalness={0.6} roughness={0.2} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 0.99} />
            </mesh>
            <mesh position={[0.08, 0.18, 0.064]}>
              <sphereGeometry args={[0.035, 14, 14]} />
              <meshStandardMaterial color="#bbf7d0" emissive="#22c55e" emissiveIntensity={1.2 * opacity} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 0.99} />
            </mesh>
          </group>
        )
      default:
        return (
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.18, 20, 20]} />
            {renderMarkerMaterial()}
          </mesh>
        )
    }
  }

  return (
    <group
      position={[device.x, 0.02, device.y]}
      rotation={[0, -angle, 0]}
      onPointerDown={(event) => {
        event.stopPropagation()
        onSelect?.()
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        setScenePointer(true)
      }}
      onPointerOut={() => setScenePointer(false)}
    >
      <pointLight color={finalColor} intensity={(isSelected ? 1.45 : 0.8) * opacity} distance={3.2} position={[0.28, 0.48, 0.14]} />
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
        <circleGeometry args={[isSelected ? 0.55 : 0.42, 48]} />
        <meshBasicMaterial color={finalColor} transparent opacity={(isSelected ? 0.18 : 0.09) * opacity} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
        <ringGeometry args={[0.24, isSelected ? 0.56 : 0.42, 56]} />
        <meshBasicMaterial color={finalColor} transparent opacity={(isSelected ? 0.46 : 0.28) * opacity} depthWrite={false} />
      </mesh>
      <mesh position={[0.32, 0.44, 0.14]}>
        <sphereGeometry args={[0.045, 14, 14]} />
        <meshStandardMaterial color="#ffffff" emissive={finalColor} emissiveIntensity={1.5 * opacity} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 0.99} />
      </mesh>
      {renderGeometry()}
      {isSelected && (
        <mesh position={[0, 0.68, 0]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={1.1 * opacity} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 0.99} />
        </mesh>
      )}
    </group>
  )
}

function CoverageOverlay({ devices, layerVisibility, opacity = 0.5 }: { devices: SecurityDevice[]; layerVisibility: Partial<Record<LayerId, boolean>>; opacity?: number }) {
  return (
    <group>
      {devices.map((device) => {
        const layerId = deviceLayerId(device)
        if (layerVisibility[layerId] === false) return null
        if (device.device_type !== 'camera' && device.device_type !== 'sensor') return null
        const color = device.device_type === 'camera' ? '#38bdf8' : '#22c55e'
        const radius = device.device_type === 'camera' ? 4.5 : 2.8
        return (
          <mesh key={`coverage-${device.id}`} position={[device.x, 0.018, device.y]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
            <circleGeometry args={[radius, 64]} />
            <meshBasicMaterial color={color} transparent opacity={0.16 * opacity} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        )
      })}
    </group>
  )
}

function HeatmapOverlay({ rooms, opacity = 0.5 }: { rooms: Room2D[]; opacity?: number }) {
  return (
    <group>
      {rooms.map((room, index) => (
        <RoomArea
          key={`heatmap-${room.label ?? index}`}
          room={room}
          selected={index % 2 === 0}
          opacity={opacity * 0.9}
        />
      ))}
    </group>
  )
}

function PathwayOverlay({ devices, layerVisibility, opacity = 0.5 }: { devices: SecurityDevice[]; layerVisibility: Partial<Record<LayerId, boolean>>; opacity?: number }) {
  const lineObject = useMemo(() => {
    const visibleDevices = devices.filter((device) => layerVisibility[deviceLayerId(device)] !== false)
    if (visibleDevices.length < 2) return null
    const points = visibleDevices.map((device) => new THREE.Vector3(device.x, 0.07, device.y))
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({ color: '#22d3ee', transparent: true, opacity })
    return new THREE.Line(geometry, material)
  }, [devices, layerVisibility, opacity])

  useEffect(() => {
    return () => {
      lineObject?.geometry.dispose()
      if (Array.isArray(lineObject?.material)) lineObject.material.forEach((material) => material.dispose())
      else lineObject?.material.dispose()
    }
  }, [lineObject])

  if (!lineObject) return null
  return <primitive object={lineObject} />
}

function normalizePointCloud(points: Array<{ x: number; y: number; z: number; r?: number; g?: number; b?: number }>, maxPoints: number): ParsedPointCloud {
  const step = Math.max(1, Math.ceil(points.length / maxPoints))
  const sampled = points.filter((_, index) => index % step === 0).slice(0, maxPoints)
  const min = sampled.reduce((acc, point) => ({
    x: Math.min(acc.x, point.x),
    y: Math.min(acc.y, point.y),
    z: Math.min(acc.z, point.z),
  }), { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY })
  const max = sampled.reduce((acc, point) => ({
    x: Math.max(acc.x, point.x),
    y: Math.max(acc.y, point.y),
    z: Math.max(acc.z, point.z),
  }), { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY })
  const center = {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2,
  }
  const span = Math.max(max.x - min.x, max.y - min.y, max.z - min.z, 1)
  const scale = 12 / span
  const positions = new Float32Array(sampled.length * 3)
  const colors = new Float32Array(sampled.length * 3)

  sampled.forEach((point, index) => {
    positions[index * 3] = (point.x - center.x) * scale
    positions[index * 3 + 1] = (point.z - center.z) * scale
    positions[index * 3 + 2] = (point.y - center.y) * scale
    const heightTone = Math.max(0.25, Math.min(1, (point.z - min.z) / Math.max(1, max.z - min.z)))
    colors[index * 3] = point.r !== undefined ? normalizeColorValue(point.r) : 0.2
    colors[index * 3 + 1] = point.g !== undefined ? normalizeColorValue(point.g) : 0.55 + heightTone * 0.35
    colors[index * 3 + 2] = point.b !== undefined ? normalizeColorValue(point.b) : 0.95
  })

  return { positions, colors, count: sampled.length }
}

function parseAsciiPly(text: string, maxPoints: number): ParsedPointCloud | null {
  const headerEnd = text.indexOf('end_header')
  if (headerEnd < 0) return null
  const header = text.slice(0, headerEnd)
  const vertexMatch = header.match(/element\s+vertex\s+(\d+)/)
  const vertexCount = vertexMatch ? Number(vertexMatch[1]) : 0
  const propertyLines = header.split(/\r?\n/).filter((line) => line.startsWith('property '))
  const propertyNames = propertyLines.map((line) => line.trim().split(/\s+/).at(-1) ?? '')
  const body = text.slice(headerEnd + 'end_header'.length).trim().split(/\r?\n/)
  const points: Array<{ x: number; y: number; z: number; r?: number; g?: number; b?: number }> = []
  const xi = propertyNames.indexOf('x')
  const yi = propertyNames.indexOf('y')
  const zi = propertyNames.indexOf('z')
  const ri = propertyNames.findIndex((name) => name === 'red' || name === 'r')
  const gi = propertyNames.findIndex((name) => name === 'green' || name === 'g')
  const bi = propertyNames.findIndex((name) => name === 'blue' || name === 'b')
  if (xi < 0 || yi < 0 || zi < 0) return null

  for (let i = 0; i < Math.min(vertexCount, body.length); i += 1) {
    const parts = body[i]!.trim().split(/\s+/).map(Number)
    const x = parts[xi] ?? Number.NaN
    const y = parts[yi] ?? Number.NaN
    const z = parts[zi] ?? Number.NaN
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
    const point: { x: number; y: number; z: number; r?: number; g?: number; b?: number } = { x, y, z }
    if (ri >= 0 && parts[ri] !== undefined) point.r = parts[ri]
    if (gi >= 0 && parts[gi] !== undefined) point.g = parts[gi]
    if (bi >= 0 && parts[bi] !== undefined) point.b = parts[bi]
    points.push(point)
  }
  return points.length > 0 ? normalizePointCloud(points, maxPoints) : null
}

function parseBinaryLittleEndianPly(buffer: ArrayBuffer, maxPoints: number): ParsedPointCloud | null {
  const headerText = new TextDecoder().decode(buffer.slice(0, Math.min(buffer.byteLength, 64_000)))
  const headerEnd = headerText.indexOf('end_header')
  if (headerEnd < 0 || !headerText.includes('format binary_little_endian')) return null
  const header = headerText.slice(0, headerEnd)
  const vertexMatch = header.match(/element\s+vertex\s+(\d+)/)
  const vertexCount = vertexMatch ? Number(vertexMatch[1]) : 0
  const propertyLines = header.split(/\r?\n/).filter((line) => line.startsWith('property '))
  const properties = propertyLines.map((line) => {
    const [, type, name] = line.trim().split(/\s+/)
    return { type: type ?? 'float', name: name ?? '' }
  })
  const dataOffset = new TextEncoder().encode(headerText.slice(0, headerEnd + 'end_header'.length)).length
  const view = new DataView(buffer, dataOffset)
  const points: Array<{ x: number; y: number; z: number; r?: number; g?: number; b?: number }> = []
  let offset = 0

  const readValue = (type: string) => {
    if (type === 'float' || type === 'float32') {
      const value = view.getFloat32(offset, true)
      offset += 4
      return value
    }
    if (type === 'double' || type === 'float64') {
      const value = view.getFloat64(offset, true)
      offset += 8
      return value
    }
    if (type === 'uchar' || type === 'uint8') {
      const value = view.getUint8(offset)
      offset += 1
      return value
    }
    if (type === 'char' || type === 'int8') {
      const value = view.getInt8(offset)
      offset += 1
      return value
    }
    if (type === 'ushort' || type === 'uint16') {
      const value = view.getUint16(offset, true)
      offset += 2
      return value
    }
    if (type === 'short' || type === 'int16') {
      const value = view.getInt16(offset, true)
      offset += 2
      return value
    }
    if (type === 'uint' || type === 'uint32') {
      const value = view.getUint32(offset, true)
      offset += 4
      return value
    }
    const value = view.getInt32(offset, true)
    offset += 4
    return value
  }

  for (let i = 0; i < vertexCount && dataOffset + offset < buffer.byteLength; i += 1) {
    const values: Record<string, number> = {}
    properties.forEach((property) => {
      values[property.name] = readValue(property.type)
    })
    if (Number.isFinite(values.x) && Number.isFinite(values.y) && Number.isFinite(values.z)) {
      const point: { x: number; y: number; z: number; r?: number; g?: number; b?: number } = {
        x: values.x!,
        y: values.y!,
        z: values.z!,
      }
      const red = values.red ?? values.r
      const green = values.green ?? values.g
      const blue = values.blue ?? values.b
      if (red !== undefined) point.r = red
      if (green !== undefined) point.g = green
      if (blue !== undefined) point.b = blue
      points.push(point)
    }
  }
  return points.length > 0 ? normalizePointCloud(points, maxPoints) : null
}

function parseLas(buffer: ArrayBuffer, maxPoints: number): ParsedPointCloud | null {
  if (buffer.byteLength < 227 || new TextDecoder().decode(buffer.slice(0, 4)) !== 'LASF') return null
  const view = new DataView(buffer)
  const pointDataOffset = view.getUint32(96, true)
  const pointFormat = view.getUint8(104) & 0b0011_1111
  const pointRecordLength = view.getUint16(105, true)
  const legacyCount = view.getUint32(107, true)
  const scaleX = view.getFloat64(131, true)
  const scaleY = view.getFloat64(139, true)
  const scaleZ = view.getFloat64(147, true)
  const offsetX = view.getFloat64(155, true)
  const offsetY = view.getFloat64(163, true)
  const offsetZ = view.getFloat64(171, true)
  const count = legacyCount > 0 ? legacyCount : Number(view.getBigUint64(247, true))
  if (!pointDataOffset || !pointRecordLength || !count) return null
  const step = Math.max(1, Math.ceil(count / maxPoints))
  const colorOffset = lasRgbOffset(pointFormat, pointRecordLength)
  const points: Array<{ x: number; y: number; z: number; r?: number; g?: number; b?: number }> = []

  for (let i = 0; i < count; i += step) {
    const offset = pointDataOffset + i * pointRecordLength
    if (offset + 12 > buffer.byteLength) break
    const point: { x: number; y: number; z: number; r?: number; g?: number; b?: number } = {
      x: view.getInt32(offset, true) * scaleX + offsetX,
      y: view.getInt32(offset + 4, true) * scaleY + offsetY,
      z: view.getInt32(offset + 8, true) * scaleZ + offsetZ,
    }
    if (colorOffset !== null && offset + colorOffset + 6 <= buffer.byteLength) {
      point.r = view.getUint16(offset + colorOffset, true)
      point.g = view.getUint16(offset + colorOffset + 2, true)
      point.b = view.getUint16(offset + colorOffset + 4, true)
    }
    points.push(point)
  }
  return points.length > 0 ? normalizePointCloud(points, maxPoints) : null
}

async function loadPointCloud(asset: UploadAsset, maxPoints: number): Promise<ParsedPointCloud | null> {
  const extension = asset.filename.split('.').pop()?.toLowerCase()
  if (asset.pointcloud_preview_url) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    const response = await fetch(`${baseUrl}${asset.pointcloud_preview_url}?max_points=${maxPoints}`)
    if (response.ok) {
      const buffer = await response.arrayBuffer()
      const format = response.headers.get('X-Point-Format') ?? 'float32-xyz'
      const raw = new Float32Array(buffer)
      if (format === 'float32-xyzrgb') {
        const count = Math.floor(raw.length / 6)
        if (count > 0) {
          const positions = new Float32Array(count * 3)
          const colors = new Float32Array(count * 3)
          for (let i = 0; i < count; i += 1) {
            const sourceIndex = i * 6
            const targetIndex = i * 3
            positions[targetIndex] = raw[sourceIndex] ?? 0
            positions[targetIndex + 1] = raw[sourceIndex + 1] ?? 0
            positions[targetIndex + 2] = raw[sourceIndex + 2] ?? 0
            colors[targetIndex] = raw[sourceIndex + 3] ?? 0.18
            colors[targetIndex + 1] = raw[sourceIndex + 4] ?? 0.75
            colors[targetIndex + 2] = raw[sourceIndex + 5] ?? 0.95
          }
          return { positions, colors, count }
        }
      } else {
        const count = Math.floor(raw.length / 3)
        if (count > 0) {
          const positions = new Float32Array(raw.length)
          positions.set(raw)
          const colors = new Float32Array(count * 3)
          for (let i = 0; i < count; i += 1) {
            const y = positions[i * 3 + 1] ?? 0
            const tone = Math.max(0.25, Math.min(1, (y + 6) / 12))
            colors[i * 3] = 0.18
            colors[i * 3 + 1] = 0.45 + tone * 0.45
            colors[i * 3 + 2] = 0.95
          }
          return { positions, colors, count }
        }
      }
    }
  }

  if (extension === 'las' || extension === 'laz') {
    return null
  }
  if (!asset.file_url) return null
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
  const response = await fetch(`${baseUrl}${asset.file_url}`)
  if (!response.ok) return null
  const buffer = await response.arrayBuffer()
  if (extension === 'ply') {
    const textHeader = new TextDecoder().decode(buffer.slice(0, Math.min(buffer.byteLength, 512)))
    if (textHeader.includes('format ascii')) return parseAsciiPly(new TextDecoder().decode(buffer), maxPoints)
    return parseBinaryLittleEndianPly(buffer, maxPoints)
  }
  if (extension === 'las') return parseLas(buffer, maxPoints)
  return null
}

function fallbackPointCloud(asset: UploadAsset, index: number, pointCount: number): ParsedPointCloud {
  const points: Array<{ x: number; y: number; z: number }> = []
  for (let i = 0; i < Math.min(pointCount, 30_000); i += 1) {
    const seed = asset.id * 131 + i * 47
    points.push({
      x: ((seed * 17) % 1000) / 70 - 7,
      y: ((seed * 29) % 1000) / 70 - 7 + index * 1.5,
      z: ((seed * 11) % 400) / 90,
    })
  }
  return normalizePointCloud(points, pointCount)
}

function PointCloudObject({ asset, index, pointCount }: { asset: UploadAsset; index: number; pointCount: number }) {
  const pointsRef = useRef<THREE.Points>(null)
  const visiblePointsRef = useRef(0)
  const [cloud, setCloud] = useState<ParsedPointCloud | null>(null)

  useEffect(() => {
    let cancelled = false
    setCloud(null)
    const fastPointCount = Math.min(pointCount, POINTCLOUD_FAST_PREVIEW_POINTS)
    loadPointCloud(asset, fastPointCount)
      .then((parsed) => {
        if (!cancelled) setCloud(parsed ?? fallbackPointCloud(asset, index, fastPointCount))
        if (cancelled || fastPointCount >= pointCount) return null
        return loadPointCloud(asset, pointCount)
      })
      .then((parsed) => {
        if (!cancelled && parsed) setCloud(parsed)
      })
      .catch(() => {
        if (!cancelled) setCloud(fallbackPointCloud(asset, index, fastPointCount))
      })
    return () => {
      cancelled = true
    }
  }, [asset, index, pointCount])

  const geometry = useMemo(() => {
    if (!cloud) return null
    const nextGeometry = new THREE.BufferGeometry()
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(cloud.positions, 3))
    nextGeometry.setAttribute('color', new THREE.BufferAttribute(cloud.colors, 3))
    nextGeometry.setDrawRange(0, 0)
    nextGeometry.computeBoundingSphere()
    return nextGeometry
  }, [cloud])

  useEffect(() => {
    visiblePointsRef.current = 0
    geometry?.setDrawRange(0, 0)
  }, [geometry])

  useFrame((_, delta) => {
    if (!geometry || !cloud || visiblePointsRef.current >= cloud.count) return
    const nextVisible = Math.min(
      cloud.count,
      visiblePointsRef.current + Math.max(8_000, cloud.count * delta * 0.42),
    )
    visiblePointsRef.current = nextVisible
    geometry.setDrawRange(0, Math.floor(nextVisible))
  })

  if (!geometry) return null

  return (
    <group>
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial size={0.024} vertexColors depthWrite={false} sizeAttenuation />
      </points>
    </group>
  )
}

function sceneBounds(walls: Wall2D[], rooms: Room2D[], devices: SecurityDevice[]) {
  const roomXs = rooms.flatMap((room) => room.points?.map((point) => point.x) ?? [room.x, room.x + room.w])
  const roomYs = rooms.flatMap((room) => room.points?.map((point) => point.y) ?? [room.y, room.y + room.h])
  const xs = [...walls.flatMap((wall) => [wall.x1, wall.x2]), ...roomXs, ...devices.map((device) => device.x)]
  const ys = [...walls.flatMap((wall) => [wall.y1, wall.y2]), ...roomYs, ...devices.map((device) => device.y)]
  if (xs.length === 0 || ys.length === 0) return { centerX: 0, centerY: 0, span: 16 }
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    span: Math.max(maxX - minX, maxY - minY, 8),
  }
}

function CameraBoundsController({ distance, span }: { distance: number; span: number }) {
  const { camera } = useThree()

  useEffect(() => {
    camera.position.set(distance, distance, distance)
    camera.near = Math.max(0.01, distance / 1000)
    camera.far = Math.max(2000, span * 12)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, distance, span])

  return null
}

function deviceLayerId(device: SecurityDevice): LayerId {
  if (device.device_type === 'camera') return 'cameras'
  if (device.device_type === 'sensor') return 'sensors'
  if (device.device_type === 'alarm') return 'alarms'
  return 'access'
}

function Scene({
  walls = [],
  rooms = [],
  openings = [],
  devices = [],
  selectedDeviceIdx,
  selectedWallIdx,
  selectedRoomIdx,
  selectedOpeningIdx,
  onSelectWall,
  onSelectRoom,
  onSelectOpening,
  onSelectDevice,
  pointClouds,
  sceneCenter = { x: 0, y: 0 },
  visibleLayers = DEFAULT_VISIBLE_LAYERS,
  layerVisibility = {},
  layerOpacity = {},
}: Props & { sceneCenter?: { x: number; y: number } }) {
  const visibleOpenings = useMemo(
    () => openings.filter((opening) => visibleLayers.openings && layerVisibility[openingLayerId(opening.type)] !== false),
    [layerVisibility, openings, visibleLayers.openings],
  )
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} />
      <group position={[-sceneCenter.x, 0, -sceneCenter.y]}>
        {visibleLayers.rooms && <FloorMesh rooms={rooms} opacity={layerOpacity.rooms ?? 1} />}
        {visibleLayers.rooms && rooms.map((r, i) => (
          <RoomArea
            key={i}
            room={r}
            selected={i === selectedRoomIdx}
            opacity={layerOpacity.rooms ?? 1}
            onSelect={() => onSelectRoom?.(i)}
          />
        ))}
        {visibleLayers.walls && walls.map((wall, i) => (
          <WallMesh
            key={`${i}-${layerOpacity.walls ?? 1}`}
            wall={wall}
            openings={visibleOpenings.filter((opening) => opening.wallIdx === i)}
            selected={i === selectedWallIdx}
            opacity={layerOpacity.walls ?? 1}
            onSelect={() => onSelectWall?.(i)}
          />
        ))}
        {visibleOpenings.map((opening, i) => {
          const wall = walls[opening.wallIdx]
          const openingIdx = openings.indexOf(opening)
          return wall ? (
            <OpeningMesh
              key={`${opening.type}-${opening.wallIdx}-${i}`}
              opening={opening}
              wall={wall}
              selected={openingIdx === selectedOpeningIdx}
              opacity={layerOpacity[openingLayerId(opening.type)] ?? 1}
              onSelect={() => onSelectOpening?.(openingIdx)}
            />
          ) : null
        })}
        {visibleLayers.devices && devices.map((d, i) => {
          const layerId = deviceLayerId(d)
          if (layerVisibility[layerId] === false) return null
          return <DeviceMarker key={d.id} device={d} selected={i === selectedDeviceIdx} opacity={layerOpacity[layerId] ?? 1} onSelect={() => onSelectDevice?.(i)} />
        })}
        {visibleLayers.coverage && <CoverageOverlay devices={devices} layerVisibility={layerVisibility} opacity={layerOpacity.coverage ?? 0.5} />}
        {visibleLayers.heatmap && <HeatmapOverlay rooms={rooms} opacity={layerOpacity.heatmap ?? 0.5} />}
        {visibleLayers.pathway && <PathwayOverlay devices={devices} layerVisibility={layerVisibility} opacity={layerOpacity.pathway ?? 0.5} />}
      </group>
      {pointClouds?.map((asset, i) => (
        <PointCloudObject
          key={asset.id}
          asset={asset}
          index={i}
          pointCount={pointBudgetForAsset(i, pointClouds.length)}
        />
      ))}
      {/* Unified grid: large area, same spacing/section pattern as 2D */}
      {visibleLayers.grid && (
        <Grid
          position={[0, -0.01, 0]}
          args={[100, 100]}
          cellSize={1}
          cellThickness={0.4 * (layerOpacity.grid ?? 1)}
          cellColor="#1f2937"
          sectionSize={5}
          sectionThickness={1 * (layerOpacity.grid ?? 1)}
          sectionColor="#334155"
        />
      )}
    </>
  )
}

export function ThreeJSViewer({
  walls = [],
  rooms = [],
  openings = [],
  devices = [],
  selectedDeviceIdx = null,
  selectedWallIdx = null,
  selectedRoomIdx = null,
  selectedOpeningIdx = null,
  onSelectWall,
  onSelectRoom,
  onSelectOpening,
  onSelectDevice,
  onSelectEmpty,
  pointClouds = [],
  showAxisGizmo = false,
  visibleLayers = DEFAULT_VISIBLE_LAYERS,
  layerVisibility = {},
  layerOpacity = {},
}: Props) {
  const axisRef = useRef<HTMLCanvasElement | null>(null);
  const bounds = useMemo(() => sceneBounds(walls, rooms, devices), [devices, rooms, walls])
  const cameraDistance = Math.max(14, bounds.span * 1.25)
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: '22px',
        overflow: 'hidden',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        background: '#111113',
      }}
    >
      <Canvas camera={{ position: [cameraDistance, cameraDistance, cameraDistance], fov: 50 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#111113']} />
        <CameraBoundsController distance={cameraDistance} span={bounds.span} />
        <Scene
          walls={walls}
          rooms={rooms}
          openings={openings}
          devices={devices}
          selectedDeviceIdx={selectedDeviceIdx}
          selectedWallIdx={selectedWallIdx}
          selectedRoomIdx={selectedRoomIdx}
          selectedOpeningIdx={selectedOpeningIdx}
          onSelectWall={onSelectWall}
          onSelectRoom={onSelectRoom}
          onSelectOpening={onSelectOpening}
          onSelectDevice={onSelectDevice}
          pointClouds={pointClouds}
          sceneCenter={{ x: bounds.centerX, y: bounds.centerY }}
          visibleLayers={visibleLayers}
          layerVisibility={layerVisibility}
          layerOpacity={layerOpacity}
        />
        <OrbitControls
          makeDefault={showAxisGizmo}
          enableDamping
          dampingFactor={0.15}
          minDistance={3}
          maxDistance={Math.max(60, bounds.span * 4)}
          maxPolarAngle={Math.PI / 2.2}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
        />
        {onSelectEmpty && (
          <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onSelectEmpty}>
            <planeGeometry args={[500, 500]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
        {showAxisGizmo && <AxisIndicator3D canvasRef={axisRef} />}
      </Canvas>

      {showAxisGizmo && (
        <canvas
          ref={axisRef}
          width={64}
          height={64}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 72,
            height: 72,
            pointerEvents: 'none',
            zIndex: 40,
          }}
        />
      )}
    </div>
  )
}
