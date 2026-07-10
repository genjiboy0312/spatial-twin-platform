import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { AxisIndicator3D } from './AxisIndicator3D'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  showAxisGizmo?: boolean
}

const FLOOR_HEIGHT = 0.15
const WALL_HEIGHT = 3
const POINTCLOUD_MAX_POINTS = 2_000_000
const POINTCLOUD_FAST_PREVIEW_POINTS = 100_000

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
        color={selected ? '#38bdf8' : '#94a3b8'}
        transparent
        opacity={selected ? 0.25 : 0.12}
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

  if (!asset.file_url) return null
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
  const response = await fetch(`${baseUrl}${asset.file_url}`)
  if (!response.ok) return null
  const buffer = await response.arrayBuffer()
  const extension = asset.filename.split('.').pop()?.toLowerCase()
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
        cellColor="#1f2937"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#334155"
      />
    </>
  )
}

export function ThreeJSViewer({ walls = [], rooms = [], devices = [], selectedDeviceIdx = null, pointClouds = [], showAxisGizmo = false }: Props) {
  const axisRef = useRef<HTMLCanvasElement | null>(null);
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
      <Canvas camera={{ position: [12, 12, 12], fov: 50 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#111113']} />
        <Scene walls={walls} rooms={rooms} devices={devices} selectedDeviceIdx={selectedDeviceIdx} pointClouds={pointClouds} />
        <OrbitControls
          makeDefault={showAxisGizmo}
          enableDamping
          dampingFactor={0.15}
          minDistance={3}
          maxDistance={60}
          maxPolarAngle={Math.PI / 2.2}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
        />
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
