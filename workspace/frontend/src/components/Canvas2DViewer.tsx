import { useRef, useEffect } from 'react'

export type Wall2D = { x1: number; y1: number; x2: number; y2: number }
export type Room2D = { x: number; y: number; w: number; h: number; label?: string }

type Props = {
  walls?: Wall2D[]
  rooms?: Room2D[]
  width?: number
  height?: number
}

const SAMPLE_ROOMS: Room2D[] = [
  { x: 2, y: 2, w: 6, h: 5, label: 'Meeting' },
  { x: 9, y: 2, w: 5, h: 5, label: 'Office A' },
  { x: 2, y: 8, w: 5, h: 4, label: 'Office B' },
  { x: 8, y: 8, w: 6, h: 4, label: 'Server' },
]

const SAMPLE_WALLS: Wall2D[] = [
  // Outer walls
  { x1: 0, y1: 0, x2: 16, y2: 0 },
  { x1: 16, y1: 0, x2: 16, y2: 13 },
  { x1: 16, y1: 13, x2: 0, y2: 13 },
  { x1: 0, y1: 13, x2: 0, y2: 0 },
  // Inner walls
  { x1: 8, y1: 0, x2: 8, y2: 7 },
  { x1: 0, y1: 7, x2: 8, y2: 7 },
  { x1: 8, y1: 7, x2: 8, y2: 13 },
  { x1: 14, y1: 7, x2: 16, y2: 7 },
]

const PADDING = 40
const GRID_SIZE = 24

export function Canvas2DViewer({ walls, rooms, width = 600, height = 480 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const data = { walls: walls ?? SAMPLE_WALLS, rooms: rooms ?? SAMPLE_ROOMS }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Calculate scale to fit content
    const maxX = Math.max(...data.walls.flatMap((w) => [w.x1, w.x2]), ...data.rooms.map((r) => r.x + r.w))
    const maxY = Math.max(...data.walls.flatMap((w) => [w.y1, w.y2]), ...data.rooms.map((r) => r.y + r.h))
    const scale = Math.min((width - PADDING * 2) / maxX, (height - PADDING * 2) / maxY)
    const ox = (width - maxX * scale) / 2
    const oy = (height - maxY * scale) / 2

    // Clear
    ctx.clearRect(0, 0, width, height)

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
    for (const room of data.rooms) {
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
    ctx.strokeStyle = '#90a4ae'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    for (const wall of data.walls) {
      ctx.beginPath()
      ctx.moveTo(ox + wall.x1 * scale, oy + wall.y1 * scale)
      ctx.lineTo(ox + wall.x2 * scale, oy + wall.y2 * scale)
      ctx.stroke()
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
  }, [width, height, data])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        borderRadius: '22px',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        background: '#0f172a',
      }}
    />
  )
}
