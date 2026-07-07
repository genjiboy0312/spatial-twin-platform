import { useRef, useEffect, useCallback, useState } from 'react'

import type { SecurityDevice, SecurityDeviceType } from '../stores/editorStore'

export type Wall2D = { x1: number; y1: number; x2: number; y2: number }
export type Room2D = { x: number; y: number; w: number; h: number; label?: string }

type EditMode = 'select' | 'wall' | 'delete' | 'device'
type Props = {
  walls: Wall2D[]
  rooms: Room2D[]
  devices: SecurityDevice[]
  selectedWallIdx?: number | null
  selectedRoomIdx?: number | null
  selectedDeviceIdx?: number | null
  editMode: EditMode
  visibleLayers: { walls: boolean; rooms: boolean; devices: boolean }
  width?: number
  height?: number
  onSelectWall?: (idx: number) => void
  onSelectRoom?: (idx: number) => void
  onSelectDevice?: (idx: number) => void
  onDrawWall?: (x1: number, y1: number, x2: number, y2: number) => void
  onDeleteAt?: (worldX: number, worldY: number) => void
  onMoveWall?: (idx: number, dx: number, dy: number) => void
  onFinishMoveWall?: (idx: number, x1: number, y1: number, x2: number, y2: number) => void
  onAddDevice?: (device: SecurityDevice) => void
  snapPoint?: (x: number, y: number) => { x: number; y: number }
  deviceType?: SecurityDeviceType
}

const PADDING = 40
const GRID_SIZE_PX = 24
const HIT_THRESHOLD_PX = 8
const ENDPOINT_RADIUS_PX = 6

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
    const dPx = d * scale
    if (dPx < bestDist) {
      bestDist = dPx
      bestIdx = i
    }
  }
  return bestDist <= HIT_THRESHOLD_PX ? bestIdx : -1
}

function findRoomIdx(wx: number, wy: number, rooms: Room2D[]): number {
  for (const [i, r] of rooms.entries()) {
    if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) return i
  }
  return -1
}

function drawDevice(ctx: CanvasRenderingContext2D, type: string, cx: number, cy: number, sel: boolean) {
  const r = 11
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = sel ? '#facc15' : '#94a3b8'
  ctx.fillStyle = sel ? 'rgba(250, 204, 21, 0.2)' : 'rgba(148, 163, 184, 0.15)'
  ctx.lineWidth = sel ? 2 : 1.5
  switch (type) {
    case 'camera':
      ctx.beginPath()
      ctx.roundRect(-r, -r * 0.7, r * 2, r * 1.4, 3)
      ctx.fill(); ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2)
      ctx.fillStyle = sel ? '#facc15' : '#64748b'
      ctx.fill()
      break
    case 'sensor':
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.arc(0, 0, r * 0.3 + i * 4, -Math.PI / 3, Math.PI / 3)
        ctx.stroke()
      }
      break
    case 'alarm':
      ctx.beginPath()
      ctx.arc(0, 2, r * 0.7, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, -3, r * 0.45, 0, Math.PI * 2)
      ctx.fillStyle = sel ? '#facc15' : '#64748b'
      ctx.fill()
      break
    case 'access':
      ctx.beginPath()
      ctx.roundRect(-r * 0.8, -r * 0.6, r * 1.6, r * 1.2, 3)
      ctx.fill(); ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-r * 0.35, -r * 0.1); ctx.lineTo(r * 0.35, -r * 0.1)
      ctx.moveTo(-r * 0.35, r * 0.1); ctx.lineTo(r * 0.35, r * 0.1)
      ctx.moveTo(-r * 0.35, r * 0.3); ctx.lineTo(r * 0.2, r * 0.3)
      ctx.stroke()
      break
  }
  ctx.restore()
}

export function Canvas2DViewer({
  walls,
  rooms,
  devices,
  selectedWallIdx,
  selectedRoomIdx,
  selectedDeviceIdx,
  editMode,
  visibleLayers,
  width = 760,
  height = 480,
  onSelectWall,
  onSelectRoom,
  onSelectDevice,
  onDrawWall,
  onDeleteAt,
  onMoveWall,
  onFinishMoveWall,
  onAddDevice,
  snapPoint,
  deviceType = 'camera',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const maxX = Math.max(...walls.flatMap((w) => [w.x1, w.x2]), ...rooms.map((r) => r.x + r.w), ...devices.map((d) => d.x), 1)
  const maxY = Math.max(...walls.flatMap((w) => [w.y1, w.y2]), ...rooms.map((r) => r.y + r.h), ...devices.map((d) => d.y), 1)
  const scale = Math.min((width - PADDING * 2) / maxX, (height - PADDING * 2) / maxY)
  const ox = (width - maxX * scale) / 2
  const oy = (height - maxY * scale) / 2

  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({ x: (sx - ox) / scale, y: (sy - oy) / scale }),
    [ox, oy, scale],
  )

  // Drag state
  const [dragInfo, setDragInfo] = useState<{
    wallIdx: number
    startMouse: { x: number; y: number }
    startWall: Wall2D
  } | null>(null)

  // Drawing preview state
  const drawStartRef = useRef<{ x: number; y: number } | null>(null)
  const drawLineRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [drawLine, setDrawLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  // Snap preview
  const [snapPointVisible, setSnapPointVisible] = useState<{ x: number; y: number } | null>(null)

  // Render
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
    for (let gx = 0; gx <= maxX; gx += GRID_SIZE_PX / scale) {
      const sx = ox + gx * scale
      ctx.beginPath()
      ctx.moveTo(sx, oy)
      ctx.lineTo(sx, oy + maxY * scale)
      ctx.stroke()
    }
    for (let gy = 0; gy <= maxY; gy += GRID_SIZE_PX / scale) {
      const sy = oy + gy * scale
      ctx.beginPath()
      ctx.moveTo(ox, sy)
      ctx.lineTo(ox + maxX * scale, sy)
      ctx.stroke()
    }

    // Rooms
    if (visibleLayers.rooms) {
      for (const [i, room] of rooms.entries()) {
        const rx = ox + room.x * scale
        const ry = oy + room.y * scale
        const rw = room.w * scale
        const rh = room.h * scale
        const isSel = i === selectedRoomIdx
        ctx.fillStyle = isSel ? 'rgba(56, 189, 248, 0.15)' : 'rgba(59, 130, 246, 0.08)'
        ctx.fillRect(rx, ry, rw, rh)
        ctx.strokeStyle = isSel ? '#38bdf8' : 'rgba(59, 130, 246, 0.3)'
        ctx.lineWidth = isSel ? 2 : 1
        ctx.strokeRect(rx, ry, rw, rh)
        if (room.label) {
          ctx.fillStyle = '#94a3b8'
          ctx.font = '12px Inter, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(room.label, rx + rw / 2, ry + rh / 2 + 4)
        }
      }
    }

    // Walls
    if (visibleLayers.walls) {
      for (const [i, w] of walls.entries()) {
        const isSel = i === selectedWallIdx
        ctx.beginPath()
        ctx.moveTo(ox + w.x1 * scale, oy + w.y1 * scale)
        ctx.lineTo(ox + w.x2 * scale, oy + w.y2 * scale)
        ctx.strokeStyle = isSel ? '#38bdf8' : '#90a4ae'
        ctx.lineWidth = isSel ? 5 : 3
        ctx.lineCap = 'round'
        ctx.stroke()
        // Endpoint dots for selected wall
        if (isSel) {
          for (const pt of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
            ctx.beginPath()
            ctx.arc(ox + pt.x * scale, oy + pt.y * scale, 5, 0, Math.PI * 2)
            ctx.fillStyle = '#38bdf8'
            ctx.fill()
          }
        }
      }
    }

    // Devices
    if (visibleLayers.devices) {
      for (const [i, d] of devices.entries()) {
        const cx = ox + d.x * scale
        const cy = oy + d.y * scale
        drawDevice(ctx, d.device_type, cx, cy, i === selectedDeviceIdx)
        // Label
        ctx.fillStyle = '#94a3b8'
        ctx.font = '10px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(d.name, cx, cy + 20)
      }
    }

    // Drawing preview line (dashed)
    const dl = drawLine
    if (dl) {
      ctx.beginPath()
      ctx.moveTo(ox + dl.x1 * scale, oy + dl.y1 * scale)
      ctx.lineTo(ox + dl.x2 * scale, oy + dl.y2 * scale)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)'
      ctx.lineWidth = 3
      ctx.setLineDash([6, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Snap point indicator
    if (snapPointVisible) {
      ctx.beginPath()
      ctx.arc(ox + snapPointVisible.x * scale, oy + snapPointVisible.y * scale, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#fbbf24'
      ctx.fill()
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Drag preview (selected wall follows cursor)
    if (dragInfo) {
      // Draw original wall position dimly
      const dw = dragInfo.startWall
      ctx.beginPath()
      ctx.moveTo(ox + dw.x1 * scale, oy + dw.y1 * scale)
      ctx.lineTo(ox + dw.x2 * scale, oy + dw.y2 * scale)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)'
      ctx.lineWidth = 2
      ctx.setLineDash([3, 3])
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
  }, [
    walls, rooms, devices, selectedWallIdx, selectedRoomIdx, selectedDeviceIdx, editMode, visibleLayers,
    drawLine, snapPointVisible, dragInfo, width, height, maxX, maxY, scale, ox, oy,
  ])

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e)
    if (!pos) return
    const wPos = screenToWorld(pos.x, pos.y)

    if (editMode === 'select') {
      // Check wall hit first
      const wIdx = findNearestWallIdx(wPos.x, wPos.y, walls, scale)
      if (wIdx >= 0) {
        onSelectWall?.(wIdx)
        setDragInfo({
          wallIdx: wIdx,
          startMouse: { x: pos.x, y: pos.y },
          startWall: { ...walls[wIdx]! },
        })
        return
      }
      // Then check room
      const rIdx = findRoomIdx(wPos.x, wPos.y, rooms)
      if (rIdx >= 0) {
        onSelectRoom?.(rIdx)
      } else {
        // Check device hit
        const dIdx = devices.findIndex((d) => Math.hypot(wPos.x - d.x, wPos.y - d.y) < 0.5)
        if (dIdx >= 0) {
          onSelectDevice?.(dIdx)
        } else {
          onSelectWall?.(-1)
          onSelectRoom?.(-1)
          onSelectDevice?.(-1)
        }
      }
    }

    if (editMode === 'wall') {
      const snapped = snapPoint ? snapPoint(wPos.x, wPos.y) : wPos
      drawStartRef.current = snapped
      setDrawLine(null)
    }

    if (editMode === 'device') {
      const snapped = snapPoint ? snapPoint(wPos.x, wPos.y) : wPos
      const overlap = devices.some((d) => Math.hypot(snapped.x - d.x, snapped.y - d.y) < 1.0)
      if (!overlap) {
        onAddDevice?.({
          id: crypto.randomUUID(),
          x: snapped.x,
          y: snapped.y,
          device_type: deviceType,
          name: deviceType.charAt(0).toUpperCase() + deviceType.slice(1),
        })
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e)
    if (!pos) return
    const wPos = screenToWorld(pos.x, pos.y)

    // Wall drag
    if (editMode === 'select' && dragInfo) {
      const dx = (pos.x - dragInfo.startMouse.x) / scale
      const dy = (pos.y - dragInfo.startMouse.y) / scale
      onMoveWall?.(dragInfo.wallIdx, dx, dy)
      return
    }

    // Drawing preview with snap
    if (editMode === 'wall' && drawStartRef.current) {
      const raw = screenToWorld(pos.x, pos.y)
      const snapped = snapPoint ? snapPoint(raw.x, raw.y) : raw
      setDrawLine({
        x1: drawStartRef.current.x,
        y1: drawStartRef.current.y,
        x2: snapped.x,
        y2: snapped.y,
      })
      // Show snap highlight at cursor if different from raw
      if (snapped.x !== raw.x || snapped.y !== raw.y) {
        setSnapPointVisible(snapped)
      } else {
        setSnapPointVisible(null)
      }
      return
    }

    // Hover snap in wall/device mode (before drawing start)
    if ((editMode === 'wall' || editMode === 'device') && snapPoint) {
      const snapped = snapPoint(wPos.x, wPos.y)
      if (snapped.x !== wPos.x || snapped.y !== wPos.y) {
        setSnapPointVisible(snapped)
      } else {
        setSnapPointVisible(null)
      }
    } else {
      setSnapPointVisible(null)
    }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e)
    if (!pos) return

    // Finish wall drag
    if (editMode === 'select' && dragInfo) {
      const wall = walls[dragInfo.wallIdx]
      if (wall) {
        onFinishMoveWall?.(dragInfo.wallIdx, wall.x1, wall.y1, wall.x2, wall.y2)
      }
      setDragInfo(null)
      return
    }

    // Finish wall drawing
    if (editMode === 'wall' && drawStartRef.current) {
      const wPos = screenToWorld(pos.x, pos.y)
      const snapped = snapPoint ? snapPoint(wPos.x, wPos.y) : wPos
      const start = drawStartRef.current
      const dxPx = Math.abs((snapped.x - start.x) * scale)
      const dyPx = Math.abs((snapped.y - start.y) * scale)
      if (dxPx > HIT_THRESHOLD_PX || dyPx > HIT_THRESHOLD_PX) {
        onDrawWall?.(start.x, start.y, snapped.x, snapped.y)
      }
      drawStartRef.current = null
      setDrawLine(null)
      setSnapPointVisible(null)
    }

    // Delete mode
    if (editMode === 'delete') {
      const wPos = screenToWorld(pos.x, pos.y)
      const wIdx = findNearestWallIdx(wPos.x, wPos.y, walls, scale)
      if (wIdx >= 0) {
        onSelectWall?.(wIdx)
        onDeleteAt?.(wPos.x, wPos.y)
      }
    }
  }

  const handleMouseLeave = () => {
    drawStartRef.current = null
    setDrawLine(null)
    setSnapPointVisible(null)
    setDragInfo(null)
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
        cursor: editMode === 'wall' || editMode === 'device' ? 'crosshair' : editMode === 'delete' ? 'not-allowed' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  )
}
