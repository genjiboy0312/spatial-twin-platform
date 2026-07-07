import type { MouseEvent } from 'react'
import type { AnchorPoint } from '../utils/alignmentUtils'

type Props = {
  anchors: AnchorPoint[]
  activeAnchorId: string | null
  width: number
  height: number
  onCanvasClick?: (x: number, y: number) => void
  mode: 'view' | 'place'
}

const ACTIVE_FILL = '#fbbf24'
const INACTIVE_FILL = '#60a5fa'
const MARKER_RADIUS = 6

export function AnchorPointMarkers({ anchors, activeAnchorId, width, height, onCanvasClick, mode }: Props) {
  const handleClick = (event: MouseEvent<SVGSVGElement>) => {
    if (mode !== 'place' || !onCanvasClick) return

    const bounds = event.currentTarget.getBoundingClientRect()
    onCanvasClick(event.clientX - bounds.left, event.clientY - bounds.top)
  }

  return (
    <svg
      className="anchor-point-markers"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onClick={handleClick}
      style={{
        cursor: mode === 'place' ? 'crosshair' : 'default',
        inset: 0,
        pointerEvents: mode === 'place' ? 'auto' : 'none',
        position: 'absolute',
      }}
    >
      {mode === 'place' && <rect width={width} height={height} fill="transparent" />}

      {anchors.map((anchor, index) => {
        const fill = anchor.id === activeAnchorId ? ACTIVE_FILL : INACTIVE_FILL
        const label = `${anchor.label} #${index + 1}`
        const labelX = anchor.localX + 12
        const labelY = anchor.localY - 10

        return (
          <g key={anchor.id}>
            <circle cx={anchor.localX} cy={anchor.localY} r={MARKER_RADIUS} fill={fill} stroke="#eef2ff" strokeWidth={1.5} />
            <rect
              x={labelX - 4}
              y={labelY - 14}
              width={Math.max(70, label.length * 7)}
              height={20}
              rx={5}
              fill="rgba(7,17,31,0.88)"
              stroke="rgba(148,163,184,0.22)"
            />
            <text x={labelX} y={labelY} fill="#eef2ff" fontSize={11} fontFamily="Inter, sans-serif">
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
