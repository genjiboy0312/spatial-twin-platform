import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Environment } from '@react-three/drei'
import type { Wall2D, Room2D } from './Canvas2DViewer'

type Props = {
  walls?: Wall2D[]
  rooms?: Room2D[]
}

const SAMPLE_ROOMS: Room2D[] = [
  { x: 2, y: 2, w: 6, h: 5, label: 'Meeting' },
  { x: 9, y: 2, w: 5, h: 5, label: 'Office A' },
  { x: 2, y: 8, w: 5, h: 4, label: 'Office B' },
  { x: 8, y: 8, w: 6, h: 4, label: 'Server' },
]

const FLOOR_HEIGHT = 0.15
const WALL_HEIGHT = 3

function WallMesh({ x1, y1, x2, y2 }: Wall2D) {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.sqrt(dx * dx + dy * dy)
  if (length < 0.01) return null
  const angle = Math.atan2(dy, dx)
  // Center point
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2

  return (
    <mesh
      position={[cx, WALL_HEIGHT / 2, cy]}
      rotation={[0, -angle, 0]}
    >
      <boxGeometry args={[length, WALL_HEIGHT, 0.15]} />
      <meshStandardMaterial color="#90a4ae" roughness={0.8} />
    </mesh>
  )
}

function FloorMesh({ rooms }: { rooms: Room2D[] }) {
  if (rooms.length === 0) return null
  // Single merged floor for all rooms
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

function RoomArea({ x, y, w, h, label }: Room2D) {
  return (
    <mesh position={[x + w / 2, 0.01, y + h / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w - 0.3, h - 0.3]} />
      <meshStandardMaterial
        color="rgba(59, 130, 246, 0.15)"
        transparent
        side={2}
        depthWrite={false}
      />
    </mesh>
  )
}

function SampleScene({ walls, rooms }: { walls: Wall2D[]; rooms: Room2D[] }) {
  return (
    <>
      {/* Ambient + directional light */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} />

      {/* Floor */}
      <FloorMesh rooms={rooms} />

      {/* Room areas */}
      {rooms.map((r, i) => (
        <RoomArea key={i} {...r} />
      ))}

      {/* Walls */}
      {walls.map((w, i) => (
        <WallMesh key={i} {...w} />
      ))}

      {/* Grid helper */}
      <Grid
        position={[0, -0.01, 0]}
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="rgba(148, 163, 184, 0.2)"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="rgba(148, 163, 184, 0.4)"
      />
    </>
  )
}

const SAMPLE_WALLS: Wall2D[] = [
  { x1: 0, y1: 0, x2: 16, y2: 0 },
  { x1: 16, y1: 0, x2: 16, y2: 13 },
  { x1: 16, y1: 13, x2: 0, y2: 13 },
  { x1: 0, y1: 13, x2: 0, y2: 0 },
  { x1: 8, y1: 0, x2: 8, y2: 7 },
  { x1: 0, y1: 7, x2: 8, y2: 7 },
  { x1: 8, y1: 7, x2: 8, y2: 13 },
  { x1: 14, y1: 7, x2: 16, y2: 7 },
]

export function ThreeJSViewer({ walls, rooms }: Props) {
  const data = {
    walls: walls ?? SAMPLE_WALLS,
    rooms: rooms ?? SAMPLE_ROOMS,
  }

  return (
    <div
      style={{
        width: '100%',
        height: 480,
        borderRadius: '22px',
        overflow: 'hidden',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        background: '#0f172a',
      }}
    >
      <Canvas
        camera={{ position: [12, 12, 12], fov: 50 }}
        gl={{ antialias: true }}
      >
        <SampleScene walls={data.walls} rooms={data.rooms} />
        <OrbitControls
          enableDamping
          dampingFactor={0.15}
          minDistance={3}
          maxDistance={40}
          maxPolarAngle={Math.PI / 2.2}
        />
        <Environment preset="night" />
      </Canvas>
    </div>
  )
}
