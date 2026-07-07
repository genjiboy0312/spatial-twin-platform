import { useMemo } from 'react'
import { PageHeader } from './PageHeader'
import { useEditorStore } from '../stores/editorStore'

const PREVIEW_WIDTH = 760
const PREVIEW_HEIGHT = 420
const SCALE = 34
const OFFSET_X = 86
const OFFSET_Y = 70

function toScreenX(x: number): number {
  return OFFSET_X + x * SCALE
}

function toScreenY(y: number): number {
  return OFFSET_Y + y * SCALE
}

export function CoveragePage() {
  const walls = useEditorStore((state) => state.walls)
  const rooms = useEditorStore((state) => state.rooms)
  const devices = useEditorStore((state) => state.devices)
  const cameras = devices.filter((device) => device.device_type === 'camera')

  const coverage = useMemo(() => {
    const totalArea = rooms.reduce((sum, room) => sum + room.w * room.h, 0)
    const coveredArea = rooms.reduce((sum, room) => {
      const center = { x: room.x + room.w / 2, y: room.y + room.h / 2 }
      const hasCamera = cameras.some((camera) => Math.hypot(camera.x - center.x, camera.y - center.y) <= 6)
      return sum + (hasCamera ? room.w * room.h : 0)
    }, 0)
    return totalArea === 0 ? 0 : Math.round((coveredArea / totalArea) * 100)
  }, [cameras, rooms])

  return (
    <section className="page-grid editor-layout" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <PageHeader
        eyebrow="Phase 6"
        title="Coverage Analysis"
        description="Review camera visibility, uncovered rooms, and device placement quality before final validation."
      />

      <div className="full-width" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 18 }}>
        <div className="viewer-container">
          <svg
            aria-label="Camera coverage analysis preview"
            role="img"
            viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}
            style={{
              background: '#0b1220',
              border: '1px solid rgba(148, 163, 184, 0.18)',
              borderRadius: 16,
              display: 'block',
              width: '100%',
            }}
          >
            {rooms.map((room, index) => {
              const center = { x: room.x + room.w / 2, y: room.y + room.h / 2 }
              const covered = cameras.some((camera) => Math.hypot(camera.x - center.x, camera.y - center.y) <= 6)
              return (
                <rect
                  key={`${room.label ?? 'room'}-${index}`}
                  x={toScreenX(room.x)}
                  y={toScreenY(room.y)}
                  width={room.w * SCALE}
                  height={room.h * SCALE}
                  fill={covered ? 'rgba(34,197,94,0.18)' : 'rgba(248,113,113,0.16)'}
                  stroke={covered ? 'rgba(74,222,128,0.72)' : 'rgba(248,113,113,0.7)'}
                  strokeWidth="1.5"
                />
              )
            })}
            {walls.map((wall, index) => (
              <line
                key={`${wall.x1}-${wall.y1}-${index}`}
                x1={toScreenX(wall.x1)}
                y1={toScreenY(wall.y1)}
                x2={toScreenX(wall.x2)}
                y2={toScreenY(wall.y2)}
                stroke="#e2e8f0"
                strokeLinecap="round"
                strokeWidth="4"
              />
            ))}
            {cameras.map((camera) => (
              <g key={camera.id}>
                <circle cx={toScreenX(camera.x)} cy={toScreenY(camera.y)} r={6 * SCALE} fill="rgba(59,130,246,0.12)" />
                <circle cx={toScreenX(camera.x)} cy={toScreenY(camera.y)} r="8" fill="#38bdf8" stroke="#eff6ff" strokeWidth="1.5" />
              </g>
            ))}
          </svg>
        </div>

        <aside className="card" style={{ borderRadius: 14 }}>
          <strong>Coverage Summary</strong>
          <div className="inspector-info" style={{ marginTop: 12 }}>
            <p><span>Coverage</span> {coverage}%</p>
            <p><span>Cameras</span> {cameras.length}</p>
            <p><span>Rooms</span> {rooms.length}</p>
            <p><span>Walls</span> {walls.length}</p>
          </div>
          <p className="hint">
            Rooms are considered covered when their center point falls within a nearby camera radius. This keeps the MVP
            deterministic until true frustum and occlusion analysis lands.
          </p>
        </aside>
      </div>
    </section>
  )
}
