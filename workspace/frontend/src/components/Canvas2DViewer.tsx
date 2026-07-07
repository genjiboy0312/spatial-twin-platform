import { useRef, useEffect, useState, useCallback } from 'react'

export type Wall2D = { x1: number; y1: number; x2: number; y2: number }
export type Room2D = { x: number; y: number; w: number; h: number; label?: string }

type EditMode = 'select' | 'wall' | 'delete'

type Props = {
  walls: Wall2D[]
  rooms: Room2D[]
  selectedWallIdx?: number | null
  editMode: EditMode
  width?: number
  height?: number
  onSelect?: (wallIdx: number) => void
  onDrawWall?: (x1: number, y1: number, x2: number, y2: number) => void
  onDeleteAt?: (worldX: number, worldY: number) => void
}

const PADDING = 40
const GRID_SIZE = 24
const HIT_THRESHOLD_PX = 8

function distToSegment(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number,
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function findNearestWallIdx(
  wx: number, wy: number, walls: Wall2D[], scale: number,
): number {
  let bestIdx = -1
  let bestDist = Infinity
    for (const [i, w] of walls.entries()) {
      const d = distToSegment(wx, wy, w.x1, w.y1, w.x2, w.y2)
      if (d * scale < bestDist) {
        bestDist = d * scale
        bestIdx = i
      }
    }
  return bestDist <= HIT_THRESHOLD_PX ? bestIdx : -1
}

export function Canvas2DViewer({
  walls,
  rooms,
  selectedWallIdx,
  editMode,
  width = 760,
  height = 480,
  onSelect,
  onDrawWall,
  onDeleteAt,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawLine, setDrawLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  const maxX = Math.max(...walls.flatMap((w) => [w.x1, w.x2]), ...rooms.map((r) => r.x + r.w), 1)
  const maxY = Math.max(...walls.flatMap((w) => [w.y1, w.y2]), ...rooms.map((r) => r.y + r.h), 1)
  const scale = Math.min((width - PADDING * 2) / maxX, (height - PADDING * 2) / maxY)
  const ox = (width - maxX * scale) / 2
  const oy = (height - maxY * scale) / 2

  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({ x: (sx - ox) / scale, y: (sy - oy) / scale }),
    [ox, oy, scale],
  )

  const drawStartRef = useRef<{ x: number; y: number } | null>(null)

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, width, height)

    // Grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)'
    ctx.lineWidth = 0.5
    for (let gx = 0; gx <= maxX; gx += GRID_SIZE / scale) {
      const sx = ox + gx * scale
      ctx.beginPath()
      ctx.moveTo(sx, oy)
      ctx.lineTo(sx, oy + maxY * scale)
      ctx.stroke()
    }
    for (let gy = 0; gy <= maxY; gy += GRID_SIZE / scale) {
      const sy = oy + gy * scale
      ctx.beginPath()
      ctx.moveTo(ox, sy)
      ctx.lineTo(ox + maxX * scale, sy)
      ctx.stroke()
    }

    // Rooms
    for (const room of rooms) {
      const rx = ox + room.x * scale
      const ry = oy + room.y * scale
      const rw = room.w * scale
      const rh = room.h * scale
      ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)'
      ctx.lineWidth = 1
      ctx.strokeRect(rx, ry, rw, rh)
      if (room.label) {
        ctx.fillStyle = '#94a3b8'
        ctx.font = '12px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(room.label, rx + rw / 2, ry + rh / 2 + 4)
      }
    }

    // Walls
    for (const [i, w] of walls.entries()) {
      ctx.beginPath()
      ctx.moveTo(ox + w.x1 * scale, oy + w.y1 * scale)
      ctx.lineTo(ox + w.x2 * scale, oy + w.y2 * scale)
      ctx.strokeStyle = i === selectedWallIdx ? '#38bdf8' : '#90a4ae'
      ctx.lineWidth = i === selectedWallIdx ? 5 : 3
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    // Drawing preview (dashed)
    if (drawLine) {
      ctx.beginPath()
      ctx.moveTo(ox + drawLine.x1 * scale, oy + drawLine.y1 * scale)
      ctx.lineTo(ox + drawLine.x2 * scale, oy + drawLine.y2 * scale)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)'
      ctx.lineWidth = 3
      ctx.setLineDash([6, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Scale bar
    const barMeters = 5
    const barPx = barMeters * scale
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(width - PADDING - barPx, height - 20)
    ctx.lineTo(width - PADDING, height - 20)
    ctx.stroke()
    ctx.fillStyle = '#38bdf8'
    ctx.font = '11px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${barMeters}m`, width - PADDING - barPx / 2, height - 28)
  }, [walls, rooms, selectedWallIdx, drawLine, width, height, maxX, maxY, scale, ox, oy])

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editMode !== 'wall') return
    const pos = getPos(e)
    if (!pos) return
    drawStartRef.current = screenToWorld(pos.x, pos.y)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editMode !== 'wall' || !drawStartRef.current) return
    const pos = getPos(e)
    if (!pos) return
    const wPos = screenToWorld(pos.x, pos.y)
    setDrawLine({ x1: drawStartRef.current.x, y1: drawStartRef.current.y, x2: wPos.x, y2: wPos.y })
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e)
    if (!pos) return

    if (editMode === 'wall') {
      const start = drawStartRef.current
      if (start) {
        const wPos = screenToWorld(pos.x, pos.y)
        const dxPx = Math.abs(pos.x - (start.x * scale + ox))
        const dyPx = Math.abs(pos.y - (start.y * scale + oy))
        if (dxPx > HIT_THRESHOLD_PX || dyPx > HIT_THRESHOLD_PX) {
          onDrawWall?.(start.x, start.y, wPos.x, wPos.y)
        }
      }
      drawStartRef.current = null
      setDrawLine(null)
    } else if (editMode === 'select') {
      const wPos = screenToWorld(pos.x, pos.y)
      const idx = findNearestWallIdx(wPos.x, wPos.y, walls, scale)
      if (idx >= 0) onSelect?.(idx)
    } else if (editMode === 'delete') {
      const wPos = screenToWorld(pos.x, pos.y)
      onDeleteAt?.(wPos.x, wPos.y)
    }
  }

  const handleMouseLeave = () => {
    drawStartRef.current = null
    setDrawLine(null)
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        borderRadius: '22px',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        background: '#0f172a',
        cursor: editMode === 'wall' ? 'crosshair' : editMode === 'delete' ? 'not-allowed' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  )
}
