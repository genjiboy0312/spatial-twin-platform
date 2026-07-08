import { useRef, useEffect, useCallback, useState } from 'react'

import type { SecurityDevice, SecurityDeviceType } from '../stores/editorStore'

export type Wall2D = { x1: number; y1: number; x2: number; y2: number }
export type Room2D = { x: number; y: number; w: number; h: number; label?: string }
export type Door2D = { wallIdx: number; position: number; width: number }
export type Window2D = { wallIdx: number; position: number; width: number }
export type Opening2D = { wallIdx: number; position: number; width: number }

type EditMode = 'select' | 'wall' | 'delete' | 'device' | 'room' | 'door' | 'window' | 'opening'
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
  onAddRoom?: (room: Room2D) => void
  onAddOpening?: (type: 'door' | 'window' | 'opening', wallIdx: number, pos: number) => void
  snapPoint?: (x: number, y: number) => { x: number; y: number }
  deviceType?: SecurityDeviceType
}

const PADDING = 40
const GRID_PX_SPACING = 28
const SECTION_MULTIPLE = 5
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

function getWallAngleAndCenter(x1: number, y1: number, x2: number, y2: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  return { angle, cx, cy }
}

function drawWallMarker(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, type: string) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  const w = 8
  const h = 12
  ctx.strokeStyle = type === 'door' ? '#facc15' : type === 'window' ? '#38bdf8' : '#a78bfa'
  ctx.lineWidth = 2
  ctx.strokeRect(-w/2, -h/2, w, h)
  if (type === 'door') {
    ctx.beginPath()
    ctx.arc(h/2, 0, h/2, -Math.PI/2, Math.PI/2)
    ctx.stroke()
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
  onSelectWall,
  onSelectRoom,
  onSelectDevice,
  onDrawWall,
  onDeleteAt,
  onMoveWall,
  onFinishMoveWall,
  onAddDevice,
  onAddRoom,
  onAddOpening,
  snapPoint,
  deviceType = 'camera',
  }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 760, height: 480 })

  // ── ResizeObserver to fill parent container ──
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const firstEntry = entries[0]
      if (!firstEntry) return
      const { width, height } = firstEntry.contentRect
      if (width > 0 && height > 0) {
        setContainerSize({ width: Math.floor(width), height: Math.floor(height) })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { width, height } = containerSize

  // ── Camera state: zoom + pan offset ──
  const [cameraZoom, setCameraZoom] = useState(1)
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const panStart = useRef({ screenX: 0, screenY: 0, offsetX: 0, offsetY: 0 })

  // ── Base scale computed from content bounds ──
  const maxX = Math.max(...walls.flatMap((w) => [w.x1, w.x2]), ...rooms.map((r) => r.x + r.w), ...devices.map((d) => d.x), 1)
  const maxY = Math.max(...walls.flatMap((w) => [w.y1, w.y2]), ...rooms.map((r) => r.y + r.h), ...devices.map((d) => d.y), 1)
  const baseScale = Math.min((width - PADDING * 2) / maxX, (height - PADDING * 2) / maxY)
  const baseOx = (width - maxX * baseScale) / 2
  const baseOy = (height - maxY * baseScale) / 2

  // Effective transform (base × camera)
  const effectiveScale = baseScale * cameraZoom
  const effectiveOx = baseOx + cameraOffset.x
  const effectiveOy = baseOy + cameraOffset.y

  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({ x: (sx - effectiveOx) / effectiveScale, y: (sy - effectiveOy) / effectiveScale }),
    [effectiveOx, effectiveOy, effectiveScale],
  )

  // Drag state
  const [dragInfo, setDragInfo] = useState<{
    wallIdx: number
    startMouse: { x: number; y: number }
    startWall: Wall2D
  } | null>(null)

  // Drawing preview state
  const drawStartRef = useRef<{ x: number; y: number } | null>(null)
  const [drawLine, setDrawLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  // Room drawing state
  const [roomDrag, setRoomDrag] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)

  // Snap preview
  const [snapPointVisible, setSnapPointVisible] = useState<{ x: number; y: number } | null>(null)

  // ── Drag & drop state ──
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!isDragOver) setIsDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const raw = e.dataTransfer.getData('application/device-type')
    if (!raw) return
    const droppedType = raw as SecurityDeviceType
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const wPos = screenToWorld(sx, sy)
    onAddDevice?.({
      id: 'dev-' + Date.now(),
      name: droppedType.charAt(0).toUpperCase() + droppedType.slice(1),
      device_type: droppedType,
      x: wPos.x,
      y: wPos.y,
    })
  }

  // ── Render ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // ── Background: dark gray (no blue tint) ──
    ctx.fillStyle = '#111113'
    ctx.fillRect(0, 0, width, height)

    // ── Infinite expanding grid ──
    // Visible world bounds (plus margin)
    const marginPx = 80
    const vLeft = (-effectiveOx - marginPx) / effectiveScale
    const vTop = (-effectiveOy - marginPx) / effectiveScale
    const vRight = (width - effectiveOx + marginPx) / effectiveScale
    const vBottom = (height - effectiveOy + marginPx) / effectiveScale

    // Grid spacing in world units (fixed screen pixel spacing)
    const gridStep = GRID_PX_SPACING / effectiveScale
    if (gridStep > 0.001) {
      const cellColor = 'rgba(148, 163, 184, 0.08)'
      const sectionColor = 'rgba(148, 163, 184, 0.18)'
      const sectionStep = gridStep * SECTION_MULTIPLE

      // Minor grid lines
      ctx.strokeStyle = cellColor
      ctx.lineWidth = 0.5

      const gStartX = Math.floor(vLeft / gridStep) * gridStep
      const gStartY = Math.floor(vTop / gridStep) * gridStep
      for (let gx = gStartX; gx <= vRight; gx += gridStep) {
        // Skip if this line is also a section line (drawn thicker)
        const isSection = Math.abs(gx % sectionStep) < 0.0001 || Math.abs(gx % sectionStep - sectionStep) < 0.0001
        if (isSection) continue
        const sx = effectiveOx + gx * effectiveScale
        ctx.beginPath()
        ctx.moveTo(sx, effectiveOy + vTop * effectiveScale)
        ctx.lineTo(sx, effectiveOy + vBottom * effectiveScale)
        ctx.stroke()
      }
      for (let gy = gStartY; gy <= vBottom; gy += gridStep) {
        const isSection = Math.abs(gy % sectionStep) < 0.0001 || Math.abs(gy % sectionStep - sectionStep) < 0.0001
        if (isSection) continue
        const sy = effectiveOy + gy * effectiveScale
        ctx.beginPath()
        ctx.moveTo(effectiveOx + vLeft * effectiveScale, sy)
        ctx.lineTo(effectiveOx + vRight * effectiveScale, sy)
        ctx.stroke()
      }

      // Section grid lines (bolder)
      ctx.strokeStyle = sectionColor
      ctx.lineWidth = 1

      const sStartX = Math.floor(vLeft / sectionStep) * sectionStep
      const sStartY = Math.floor(vTop / sectionStep) * sectionStep
      for (let gx = sStartX; gx <= vRight; gx += sectionStep) {
        const sx = effectiveOx + gx * effectiveScale
        ctx.beginPath()
        ctx.moveTo(sx, effectiveOy + vTop * effectiveScale)
        ctx.lineTo(sx, effectiveOy + vBottom * effectiveScale)
        ctx.stroke()
      }
      for (let gy = sStartY; gy <= vBottom; gy += sectionStep) {
        const sy = effectiveOy + gy * effectiveScale
        ctx.beginPath()
        ctx.moveTo(effectiveOx + vLeft * effectiveScale, sy)
        ctx.lineTo(effectiveOx + vRight * effectiveScale, sy)
        ctx.stroke()
      }
    }

    // ── Rooms ──
    if (visibleLayers.rooms) {
      for (const [i, room] of rooms.entries()) {
        const rx = effectiveOx + room.x * effectiveScale
        const ry = effectiveOy + room.y * effectiveScale
        const rw = room.w * effectiveScale
        const rh = room.h * effectiveScale
        const isSel = i === selectedRoomIdx
        ctx.fillStyle = isSel ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148, 163, 184, 0.06)'
        ctx.fillRect(rx, ry, rw, rh)
        ctx.strokeStyle = isSel ? '#38bdf8' : 'rgba(148, 163, 184, 0.25)'
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

    // ── Walls ──
    if (visibleLayers.walls) {
      for (const [i, w] of walls.entries()) {
        const isSel = i === selectedWallIdx
        ctx.beginPath()
        ctx.moveTo(effectiveOx + w.x1 * effectiveScale, effectiveOy + w.y1 * effectiveScale)
        ctx.lineTo(effectiveOx + w.x2 * effectiveScale, effectiveOy + w.y2 * effectiveScale)
        ctx.strokeStyle = isSel ? '#38bdf8' : '#90a4ae'
        ctx.lineWidth = isSel ? 5 : 3
        ctx.lineCap = 'round'
        ctx.stroke()
        if (isSel) {
          for (const pt of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
            ctx.beginPath()
            ctx.arc(effectiveOx + pt.x * effectiveScale, effectiveOy + pt.y * effectiveScale, 5, 0, Math.PI * 2)
            ctx.fillStyle = '#38bdf8'
            ctx.fill()
          }
        }
      }
    }

    // ── Devices ──
    if (visibleLayers.devices) {
      for (const [i, d] of devices.entries()) {
        const cx = effectiveOx + d.x * effectiveScale
        const cy = effectiveOy + d.y * effectiveScale
        drawDevice(ctx, d.device_type, cx, cy, i === selectedDeviceIdx)
        ctx.fillStyle = '#94a3b8'
        ctx.font = '10px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(d.name, cx, cy + 20)
      }
    }

    // ── Drawing preview line (dashed) ──
    const dl = drawLine
    if (dl) {
      ctx.beginPath()
      ctx.moveTo(effectiveOx + dl.x1 * effectiveScale, effectiveOy + dl.y1 * effectiveScale)
      ctx.lineTo(effectiveOx + dl.x2 * effectiveScale, effectiveOy + dl.y2 * effectiveScale)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)'
      ctx.lineWidth = 3
      ctx.setLineDash([6, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // ── Snap point indicator ──
    if (snapPointVisible) {
      ctx.beginPath()
      ctx.arc(effectiveOx + snapPointVisible.x * effectiveScale, effectiveOy + snapPointVisible.y * effectiveScale, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#fbbf24'
      ctx.fill()
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // ── Drag preview ──
    if (dragInfo) {
      const dw = dragInfo.startWall
      ctx.beginPath()
      ctx.moveTo(effectiveOx + dw.x1 * effectiveScale, effectiveOy + dw.y1 * effectiveScale)
      ctx.lineTo(effectiveOx + dw.x2 * effectiveScale, effectiveOy + dw.y2 * effectiveScale)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)'
      ctx.lineWidth = 2
      ctx.setLineDash([3, 3])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // ── Room preview rectangle ──
    if (roomDrag) {
      const rx = effectiveOx + Math.min(roomDrag.startX, roomDrag.currentX) * effectiveScale
      const ry = effectiveOy + Math.min(roomDrag.startY, roomDrag.currentY) * effectiveScale
      const rw = Math.abs(roomDrag.currentX - roomDrag.startX) * effectiveScale
      const rh = Math.abs(roomDrag.currentY - roomDrag.startY) * effectiveScale
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(rx, ry, rw, rh)
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)'
      ctx.fillRect(rx, ry, rw, rh)
    }

    // ── Scale bar ──
    const barMeters = 5
    const barPx = barMeters * effectiveScale
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
    drawLine, snapPointVisible, dragInfo, roomDrag, width, height, maxX, maxY, baseScale, baseOx, baseOy,
    cameraZoom, cameraOffset,
  ])

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  // ── Right-click pan start ──
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e)
    if (!pos) return

    // Right-click → pan
    if (e.button === 2) {
      isPanning.current = true
      panStart.current = { screenX: e.clientX, screenY: e.clientY, offsetX: cameraOffset.x, offsetY: cameraOffset.y }
      return
    }

    // Left-click → editing actions
    const wPos = screenToWorld(pos.x, pos.y)

    if (editMode === 'select') {
      const wIdx = findNearestWallIdx(wPos.x, wPos.y, walls, effectiveScale)
      if (wIdx >= 0) {
        onSelectWall?.(wIdx)
        setDragInfo({
          wallIdx: wIdx,
          startMouse: { x: pos.x, y: pos.y },
          startWall: { ...walls[wIdx]! },
        })
        return
      }
      const rIdx = findRoomIdx(wPos.x, wPos.y, rooms)
      if (rIdx >= 0) {
        onSelectRoom?.(rIdx)
      } else {
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

    if (editMode === 'room') {
      const snapped = snapPoint ? snapPoint(wPos.x, wPos.y) : wPos
      setRoomDrag({ startX: snapped.x, startY: snapped.y, currentX: snapped.x, currentY: snapped.y })
    }

    if (editMode === 'door' || editMode === 'window' || editMode === 'opening') {
      const wIdx = findNearestWallIdx(wPos.x, wPos.y, walls, effectiveScale)
      if (wIdx >= 0) {
        onAddOpening?.(editMode, wIdx, 0.5)
      }
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
    // Right-click pan
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.screenX
      const dy = e.clientY - panStart.current.screenY
      setCameraOffset({ x: panStart.current.offsetX + dx, y: panStart.current.offsetY + dy })
      return
    }

    const pos = getPos(e)
    if (!pos) return
    const wPos = screenToWorld(pos.x, pos.y)

    // Wall drag
    if (editMode === 'select' && dragInfo) {
      const dx = (pos.x - dragInfo.startMouse.x) / effectiveScale
      const dy = (pos.y - dragInfo.startMouse.y) / effectiveScale
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
      if (snapped.x !== raw.x || snapped.y !== raw.y) {
        setSnapPointVisible(snapped)
      } else {
        setSnapPointVisible(null)
      }
      return
    }

    // Room drag preview
    if (editMode === 'room' && roomDrag) {
      const raw = screenToWorld(pos.x, pos.y)
      const snapped = snapPoint ? snapPoint(raw.x, raw.y) : raw
      setRoomDrag((prev) => prev ? { ...prev, currentX: snapped.x, currentY: snapped.y } : null)
      return
    }

    // Hover snap
    if ((editMode === 'wall' || editMode === 'device' || editMode === 'room' || editMode === 'door' || editMode === 'window' || editMode === 'opening') && snapPoint) {
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
    // Stop panning
    if (isPanning.current) {
      isPanning.current = false
      return
    }

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
      const dxPx = Math.abs((snapped.x - start.x) * effectiveScale)
      const dyPx = Math.abs((snapped.y - start.y) * effectiveScale)
      if (dxPx > HIT_THRESHOLD_PX || dyPx > HIT_THRESHOLD_PX) {
        onDrawWall?.(start.x, start.y, snapped.x, snapped.y)
      }
      drawStartRef.current = null
      setDrawLine(null)
      setSnapPointVisible(null)
    }

    // Finish room drawing
    if (editMode === 'room' && roomDrag) {
      const dx = Math.abs(roomDrag.currentX - roomDrag.startX)
      const dy = Math.abs(roomDrag.currentY - roomDrag.startY)
      if (dx > 0.5 && dy > 0.5) {
        const x = Math.min(roomDrag.startX, roomDrag.currentX)
        const y = Math.min(roomDrag.startY, roomDrag.currentY)
        onAddRoom?.({ x, y, w: dx, h: dy, label: `Room ${rooms.length + 1}` })
      }
      setRoomDrag(null)
    }

    // Delete mode
    if (editMode === 'delete') {
      const wPos = screenToWorld(pos.x, pos.y)
      const wIdx = findNearestWallIdx(wPos.x, wPos.y, walls, effectiveScale)
      if (wIdx >= 0) {
        onSelectWall?.(wIdx)
        onDeleteAt?.(wPos.x, wPos.y)
      }
    }
  }

  const handleMouseLeave = () => {
    isPanning.current = false
    drawStartRef.current = null
    setDrawLine(null)
    setSnapPointVisible(null)
    setDragInfo(null)
    setRoomDrag(null)
  }

  // ── Mouse wheel zoom ──
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()

    // 1. 현재 마우스 위치(화면 좌표) 계산
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    // 2. 줌 이전의 월드 좌표 계산
    const worldPosBefore = screenToWorld(mx, my)

    // 3. 새로운 줌 배율 계산
    const delta = -e.deltaY
    const factor = 1 + Math.abs(delta) * 0.002
    const newZoom = delta > 0 ? cameraZoom * factor : cameraZoom / factor
    const finalZoom = Math.max(0.1, Math.min(20, newZoom))

    // 4. 줌 업데이트 및 오프셋 조정 (커서 위치 고정)
    setCameraZoom(finalZoom)

    const newEffectiveScale = baseScale * finalZoom
    const newEffectiveOx = mx - worldPosBefore.x * newEffectiveScale
    const newEffectiveOy = my - worldPosBefore.y * newEffectiveScale

    setCameraOffset({
      x: newEffectiveOx - baseOx,
      y: newEffectiveOy - baseOy,
    })
  }

  // Prevent default wheel on the canvas element
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const prevent = (e: WheelEvent) => e.preventDefault()
    el.addEventListener('wheel', prevent, { passive: false })
    return () => el.removeEventListener('wheel', prevent)
  }, [])

  // ── Middle-click auto-scroll cursor ──
  const cursor =
    isPanning.current ? 'grabbing' :
    editMode === 'wall' || editMode === 'device' || editMode === 'room' ? 'crosshair' :
    editMode === 'delete' ? 'not-allowed' : 'default'

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        minHeight: 0,
        borderRadius: '22px',
        outline: isDragOver ? '2px solid var(--accent, #38bdf8)' : 'none',
        outlineOffset: -2,
        transition: 'outline 0.15s ease',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          borderRadius: '22px',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          background: '#111113',
          cursor,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  )
}
