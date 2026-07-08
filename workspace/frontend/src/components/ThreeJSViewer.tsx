import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Environment } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Wall2D, Room2D } from './Canvas2DViewer'
import type { SecurityDevice } from '../stores/editorStore'
import { DEVICE_COLORS } from '../constants/devices'
import type { UploadAsset } from '../api/uploads'

type Props = {
  walls?: Wall2D[]
  rooms?: Room2D[]
  devices?: SecurityDevice[]
  selectedDeviceIdx?: number | null
  onSelectDevice?: (idx: number) => void
  viewMode?: '2d' | '3d'
  pointClouds?: UploadAsset[]
}

const FLOOR_HEIGHT = 0.15
const WALL_HEIGHT = 3
const POINTCLOUD_MAX_POINTS = 500_000

function pointBudgetForAsset(index: number, totalAssets: number) {
  if (totalAssets <= 0) return 0
  const base = Math.floor(POINTCLOUD_MAX_POINTS / totalAssets)
  const remainder = POINTCLOUD_MAX_POINTS % totalAssets
  return base + (index < remainder ? 1 : 0)
}

function WallMesh({ x1, y1, x2, y2, selected }: Wall2D & { selected?: boolean }) {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.sqrt(dx * dx + dy * dy)
  if (length < 0.01) return null
  const angle = Math.atan2(dy, dx)
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2

  return (
    <mesh position={[cx, WALL_HEIGHT / 2, cy]} rotation={[0, -angle, 0]}>
      <boxGeometry args={[length, WALL_HEIGHT, 0.15]} />
      <meshStandardMaterial color={selected ? '#38bdf8' : '#90a4ae'} roughness={0.8} />
    </mesh>
  )
}

function FloorMesh({ rooms }: { rooms: Room2D[] }) {
  if (rooms.length === 0) return null
  const minX = Math.min(...rooms.map((r) => r.x))
  const maxX = Math.max(...rooms.map((r) => r.x + r.w))
  const minY = Math.min(...rooms.map((r) => r.y))
  const maxY = Math.max(...rooms.map((r) => r.y + r.h))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const w = maxX - minX
  const h = maxY - minY

  return (
    <mesh position={[cx, -FLOOR_HEIGHT / 2, cy]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w + 2, h + 2]} />
      <meshStandardMaterial color="#1e293b" roughness={0.9} />
    </mesh>
  )
}

function RoomArea({ x, y, w, h, label, selected }: Room2D & { selected?: boolean }) {
  return (
    <mesh position={[x + w / 2, 0.01, y + h / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w - 0.3, h - 0.3]} />
      <meshStandardMaterial
        color={selected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(148, 163, 184, 0.12)'}
        transparent
        side={2}
        depthWrite={false}
      />
    </mesh>
  )
}

function DeviceMarker({ device, selected }: { device: SecurityDevice; selected?: boolean }) {
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
              <meshStandardMaterial color="#05070a" metalness={0.7} roughness={0.18} />
            </mesh>
            <mesh position={[0, 0.34, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.12, 24]} />
              <meshBasicMaterial color={finalColor} transparent opacity={0.5} depthWrite={false} />
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
              <meshStandardMaterial color="#f8fafc" emissive={finalColor} emissiveIntensity={1.2} />
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
              <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={isSelected ? 0.9 : 0.45} />
            </mesh>
            <mesh position={[0, 0.42, 0]}>
              <sphereGeometry args={[0.08, 18, 18]} />
              <meshStandardMaterial color="#fee2e2" emissive="#ef4444" emissiveIntensity={1.1} />
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
              <meshStandardMaterial color="#05070a" metalness={0.6} roughness={0.2} />
            </mesh>
            <mesh position={[0.08, 0.18, 0.064]}>
              <sphereGeometry args={[0.035, 14, 14]} />
              <meshStandardMaterial color="#bbf7d0" emissive="#22c55e" emissiveIntensity={1.2} />
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
    <group position={[device.x, 0.02, device.y]} rotation={[0, -angle, 0]}>
      <pointLight color={finalColor} intensity={isSelected ? 1.45 : 0.8} distance={3.2} position={[0.28, 0.48, 0.14]} />
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
        <circleGeometry args={[isSelected ? 0.55 : 0.42, 48]} />
        <meshBasicMaterial color={finalColor} transparent opacity={isSelected ? 0.18 : 0.09} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
        <ringGeometry args={[0.24, isSelected ? 0.56 : 0.42, 56]} />
        <meshBasicMaterial color={finalColor} transparent opacity={isSelected ? 0.46 : 0.28} depthWrite={false} />
      </mesh>
      <mesh position={[0.32, 0.44, 0.14]}>
        <sphereGeometry args={[0.045, 14, 14]} />
        <meshStandardMaterial color="#ffffff" emissive={finalColor} emissiveIntensity={1.5} />
      </mesh>
      {renderGeometry()}
      {isSelected && (
        <mesh position={[0, 0.68, 0]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={1.1} />
        </mesh>
      )}
    </group>
  )
}

function PointCloudObject({ asset, index, pointCount }: { asset: UploadAsset; index: number; pointCount: number }) {
  const pointsRef = useRef<THREE.Points>(null)
  const visiblePointsRef = useRef(0)
  const geometry = useMemo(() => {
    const positions = new Float32Array(pointCount * 3)
    const colors = new Float32Array(pointCount * 3)
    const color = new THREE.Color(index % 2 === 0 ? '#38bdf8' : '#22c55e')
    const baseX = (index % 4) * 3.2 - 4.8
    const baseZ = Math.floor(index / 4) * 3.2 - 2.2

    for (let i = 0; i < pointCount; i += 1) {
      const seed = asset.id * 131 + i * 47
      const ring = (seed % 100) / 100
      const angle = ((seed * 7) % 360) * (Math.PI / 180)
      const radius = 1.4 + ring * 3.8
      positions[i * 3] = baseX + Math.cos(angle) * radius + ((seed % 17) - 8) * 0.035
      positions[i * 3 + 1] = 0.05 + ((seed * 11) % 180) / 140
      positions[i * 3 + 2] = baseZ + Math.sin(angle) * radius + (((seed * 3) % 19) - 9) * 0.035
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }

    const nextGeometry = new THREE.BufferGeometry()
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    nextGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    nextGeometry.setDrawRange(0, 0)
    nextGeometry.computeBoundingSphere()
    return nextGeometry
  }, [asset.id, index, pointCount])

  useEffect(() => {
    visiblePointsRef.current = 0
    geometry.setDrawRange(0, 0)
  }, [geometry])

  useFrame((_, delta) => {
    if (visiblePointsRef.current >= pointCount) return
    const nextVisible = Math.min(
      pointCount,
      visiblePointsRef.current + Math.max(8_000, pointCount * delta * 0.42),
    )
    visiblePointsRef.current = nextVisible
    geometry.setDrawRange(0, Math.floor(nextVisible))
  })

  return (
    <group>
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial size={0.045} vertexColors transparent opacity={0.82} depthWrite={false} />
      </points>
      <mesh position={[(index % 4) * 3.2 - 4.8, 0.02, Math.floor(index / 4) * 3.2 - 2.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 5.35, 64]} />
        <meshBasicMaterial color={index % 2 === 0 ? '#38bdf8' : '#22c55e'} transparent opacity={0.14} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Scene({ walls, rooms, devices, selectedDeviceIdx, pointClouds }: Props) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} />
      <FloorMesh rooms={rooms ?? []} />
      {rooms?.map((r, i) => <RoomArea key={i} {...r} />)}
      {walls?.map((w, i) => <WallMesh key={i} {...w} />)}
      {devices?.map((d, i) => <DeviceMarker key={d.id} device={d} selected={i === selectedDeviceIdx} />)}
      {pointClouds?.map((asset, i) => (
        <PointCloudObject
          key={asset.id}
          asset={asset}
          index={i}
          pointCount={pointBudgetForAsset(i, pointClouds.length)}
        />
      ))}
      {/* Unified grid: large area, same spacing/section pattern as 2D */}
      <Grid
        position={[0, -0.01, 0]}
        args={[100, 100]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="rgba(148, 163, 184, 0.08)"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="rgba(148, 163, 184, 0.20)"
      />
    </>
  )
}

export function ThreeJSViewer({ walls = [], rooms = [], devices = [], selectedDeviceIdx = null, pointClouds = [] }: Props) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '22px',
        overflow: 'hidden',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        background: '#111113',
      }}
    >
      <Canvas camera={{ position: [12, 12, 12], fov: 50 }} gl={{ antialias: true }}>
        <color attach="background" args={['#111113']} />
        <Scene walls={walls} rooms={rooms} devices={devices} selectedDeviceIdx={selectedDeviceIdx} pointClouds={pointClouds} />
        <OrbitControls enableDamping dampingFactor={0.15} minDistance={3} maxDistance={60} maxPolarAngle={Math.PI / 2.2} />
        <Environment preset="night" />
      </Canvas>
    </div>
  )
}
