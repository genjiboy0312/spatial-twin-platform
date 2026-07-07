import { useMemo, useState } from 'react'
import { PageHeader } from './PageHeader'
import { useEditorStore } from '../stores/editorStore'

type Waypoint = { x: number; y: number; label: string }

const START: Waypoint = { x: 2, y: 2, label: 'Start' }
const EXIT: Waypoint = { x: 14, y: 11, label: 'Exit' }
const SCALE = 34
const OFFSET_X = 86
const OFFSET_Y = 70

function toScreenX(x: number): number {
  return OFFSET_X + x * SCALE
}

function toScreenY(y: number): number {
  return OFFSET_Y + y * SCALE
}

export function PathfindingPage() {
  const walls = useEditorStore((state) => state.walls)
  const rooms = useEditorStore((state) => state.rooms)
  const [avoidServerRoom, setAvoidServerRoom] = useState(false)

  const path = useMemo(() => {
    if (avoidServerRoom) {
      return [START, { x: 2, y: 7, label: 'Corridor' }, { x: 8, y: 7, label: 'Junction' }, { x: 14, y: 7, label: 'Hall' }, EXIT]
    }
    return [START, { x: 8, y: 5, label: 'Direct route' }, EXIT]
  }, [avoidServerRoom])

  const pathLength = path.slice(1).reduce((sum, point, index) => {
    const prev = path[index]!
    return sum + Math.hypot(point.x - prev.x, point.y - prev.y)
  }, 0)

  return (
    <section className="page-grid editor-layout" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <PageHeader
        eyebrow="Phase 6"
        title="Pathfinding"
        description="Calculate evacuation or patrol routes across the current floor plan with simple constraint controls."
      />

      <div className="full-width" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 18 }}>
        <div className="viewer-container">
          <svg
            aria-label="Pathfinding route preview"
            role="img"
            viewBox="0 0 760 420"
            style={{
              background: '#0b1220',
              border: '1px solid rgba(148, 163, 184, 0.18)',
              borderRadius: 16,
              display: 'block',
              width: '100%',
            }}
          >
            {rooms.map((room, index) => (
              <rect
                key={`${room.label ?? 'room'}-${index}`}
                x={toScreenX(room.x)}
                y={toScreenY(room.y)}
                width={room.w * SCALE}
                height={room.h * SCALE}
                fill="rgba(59,130,246,0.12)"
                stroke="rgba(96,165,250,0.45)"
              />
            ))}
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
            <polyline
              fill="none"
              points={path.map((point) => `${toScreenX(point.x)},${toScreenY(point.y)}`).join(' ')}
              stroke="#22c55e"
              strokeDasharray="8 6"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="5"
            />
            {path.map((point, index) => (
              <g key={`${point.label}-${index}`}>
                <circle cx={toScreenX(point.x)} cy={toScreenY(point.y)} r="8" fill={index === 0 ? '#38bdf8' : '#22c55e'} />
                <text x={toScreenX(point.x) + 12} y={toScreenY(point.y) - 10} fill="#e2e8f0" fontSize="11">
                  {point.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <aside className="card" style={{ borderRadius: 14 }}>
          <strong>Route Controls</strong>
          <label className="snap-toggle" style={{ marginTop: 14 }}>
            <input checked={avoidServerRoom} onChange={(event) => setAvoidServerRoom(event.target.checked)} type="checkbox" />
            <span>Avoid server room</span>
          </label>
          <div className="inspector-info" style={{ marginTop: 12 }}>
            <p><span>Waypoints</span> {path.length}</p>
            <p><span>Length</span> {pathLength.toFixed(1)} m</p>
            <p><span>Mode</span> {avoidServerRoom ? 'Constrained' : 'Fastest'}</p>
          </div>
          <p className="hint">The MVP uses deterministic waypoints. It is ready for graph-based A* once doors and stairs are connected.</p>
        </aside>
      </div>
    </section>
  )
}
