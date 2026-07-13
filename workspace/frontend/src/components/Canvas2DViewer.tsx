import { useRef, useEffect, useCallback, useState } from 'react'

import type { EditorVisibleLayers, SecurityDevice, SecurityDeviceType } from '../stores/editorStore'
import type { LayerId } from '../stores/layerStore'

export type Wall2D = { x1: number; y1: number; x2: number; y2: number }
export type Room2D = {
  x: number
  y: number
  w: number
  h: number
  label?: string
  generated?: boolean
  points?: Array<{ x: number; y: number }> | null
}
export type Door2D = { wallIdx: number; position: number; width: number }
export type Window2D = { wallIdx: number; position: number; width: number }
export type Opening2D = { wallIdx: number; position: number; width: number }
export type WallOpening2D = {
  type: 'door' | 'window' | 'opening'
  wallIdx: number
  position: number
  width: number
}
type OpeningCursorPreview = {
  type: WallOpening2D['type']
  x: number
  y: number
  angle: number
  width: number
}

function openingLayerId(type: WallOpening2D['type']): LayerId {
  if (type === 'door') return 'doors'
  if (type === 'window') return 'windows'
  return 'passages'
}

function deviceLayerId(type: SecurityDeviceType): LayerId {
  if (type === 'camera') return 'cameras'
  if (type === 'sensor') return 'sensors'
  if (type === 'alarm') return 'alarms'
  return 'access'
}

type EditMode = 'select' | 'wall' | 'delete' | 'device' | 'room' | 'door' | 'window' | 'opening'
type Props = {
  walls: Wall2D[]
  rooms: Room2D[]
  openings?: WallOpening2D[]
  devices: SecurityDevice[]
  selectedWallIdx?: number | null
  selectedRoomIdx?: number | null
  selectedOpeningIdx?: number | null
  selectedDeviceIdx?: number | null
  editMode: EditMode
  visibleLayers: EditorVisibleLayers
  layerVisibility?: Partial<Record<LayerId, boolean>>
  layerOpacity?: Partial<Record<LayerId, number>>
  showEndpoints?: boolean
  width?: number
  height?: number
  onSelectWall?: (idx: number) => void
  onSelectRoom?: (idx: number) => void
  onSelectOpening?: (idx: number) => void
  onSelectDevice?: (idx: number) => void
  onDrawWall?: (x1: number, y1: number, x2: number, y2: number) => void
  onDrawWalls?: (walls: Wall2D[]) => void
  onDeleteAt?: (worldX: number, worldY: number) => void
  onDeleteOpening?: (idx: number) => void
  onUpdateWall?: (idx: number, wall: Partial<Wall2D>, recordHistory?: boolean) => void
  onMoveWallEndpoint?: (idx: number, endpoint: 'start' | 'end', x: number, y: number, recordHistory?: boolean) => void
  onBeginEdit?: () => void
  onFinishMoveWall?: (idx: number, x1: number, y1: number, x2: number, y2: number) => void
  onAddDevice?: (device: SecurityDevice) => void
  onAddOpening?: (opening: WallOpening2D) => void
  snapPoint?: (x: number, y: number) => { x: number; y: number }
  deviceType?: SecurityDeviceType
}

const PADDING = 40
const GRID_PX_SPACING = 28
const SECTION_MULTIPLE = 5
const HIT_THRESHOLD_PX = 16
const OPENING_HIT_THRESHOLD_PX = 30
const ENDPOINT_RADIUS_PX = 6
const MIN_SEGMENT_LENGTH = 0.02
const DEFAULT_DOOR_WIDTH = 1.0
const DEFAULT_WINDOW_WIDTH = 1.5
const DEFAULT_OPENING_WIDTH = 0.9

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

function findClosestWallIdx(wx: number, wy: number, walls: Wall2D[]): number {
  let bestIdx = -1
  let bestDist = Infinity
  for (const [i, w] of walls.entries()) {
    const d = distToSegment(wx, wy, w.x1, w.y1, w.x2, w.y2)
    if (d < bestDist) {
      bestDist = d
      bestIdx = i
    }
  }
  return bestIdx
}

function findOpeningWallIdx(wx: number, wy: number, walls: Wall2D[], scale: number): number {
  let bestIdx = -1
  let bestDistPx = Infinity
  for (const [i, wall] of walls.entries()) {
    const dPx = distToSegment(wx, wy, wall.x1, wall.y1, wall.x2, wall.y2) * scale
    if (dPx < bestDistPx) {
      bestDistPx = dPx
      bestIdx = i
    }
  }
  return bestDistPx <= OPENING_HIT_THRESHOLD_PX ? bestIdx : -1
}

function nearestPointOnWall(wx: number, wy: number, wall: Wall2D) {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return { x: wall.x1, y: wall.y1, t: 0 }
  const rawT = ((wx - wall.x1) * dx + (wy - wall.y1) * dy) / lenSq
  const t = Math.max(0, Math.min(1, rawT))
  return { x: wall.x1 + dx * t, y: wall.y1 + dy * t, t }
}

function openingWidthForType(type: WallOpening2D['type']) {
  if (type === 'door') return DEFAULT_DOOR_WIDTH
  if (type === 'window') return DEFAULT_WINDOW_WIDTH
  return DEFAULT_OPENING_WIDTH
}

function openingCursorWidthForType(type: WallOpening2D['type']) {
  return openingWidthForType(type) * 0.62
}

function computeWallConstrainedOpening(wall: Wall2D, localPoint: { x: number; y: number }, desiredWidth: number): WallOpening2D | null {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const wallLength = Math.hypot(dx, dy)
  if (wallLength <= 0) return null

  const width = Math.max(0.1, Math.min(desiredWidth, wallLength))
  const halfWidth = width / 2
  const rawDistance = ((localPoint.x - wall.x1) * dx + (localPoint.y - wall.y1) * dy) / wallLength
  const distance = Math.max(halfWidth, Math.min(wallLength - halfWidth, rawDistance))
  return {
    type: 'door',
    wallIdx: -1,
    position: distance / wallLength,
    width,
  }
}

function findNearestEndpoint(
  wx: number,
  wy: number,
  walls: Wall2D[],
  scale: number,
): { wallIdx: number; endpoint: 'start' | 'end'; x: number; y: number } | null {
  let best: { wallIdx: number; endpoint: 'start' | 'end'; x: number; y: number; distancePx: number } | null = null
  for (const [wallIdx, wall] of walls.entries()) {
    const endpoints = [
      { endpoint: 'start' as const, x: wall.x1, y: wall.y1 },
      { endpoint: 'end' as const, x: wall.x2, y: wall.y2 },
    ]
    for (const point of endpoints) {
      const distancePx = Math.hypot(wx - point.x, wy - point.y) * scale
      if (distancePx <= ENDPOINT_RADIUS_PX + 6 && (!best || distancePx < best.distancePx)) {
        best = { wallIdx, ...point, distancePx }
      }
    }
  }
  return best ? { wallIdx: best.wallIdx, endpoint: best.endpoint, x: best.x, y: best.y } : null
}

function findRoomIdx(wx: number, wy: number, rooms: Room2D[]): number {
  for (const [i, r] of rooms.entries()) {
    if (r.points && r.points.length >= 3 && pointInPolygon(wx, wy, r.points)) return i
    if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) return i
  }
  return -1
}

function findOpeningIdx(wx: number, wy: number, walls: Wall2D[], openings: WallOpening2D[], scale: number): number {
  let bestIdx = -1
  let bestDistPx = Infinity
  for (const [idx, opening] of openings.entries()) {
    const wall = walls[opening.wallIdx]
    if (!wall) continue
    const point = nearestPointOnWall(
      wall.x1 + (wall.x2 - wall.x1) * opening.position,
      wall.y1 + (wall.y2 - wall.y1) * opening.position,
      wall,
    )
    const distancePx = Math.hypot(wx - point.x, wy - point.y) * scale
    if (distancePx < bestDistPx) {
      bestDistPx = distancePx
      bestIdx = idx
    }
  }
  return bestDistPx <= HIT_THRESHOLD_PX + 8 ? bestIdx : -1
}

function pointInPolygon(x: number, y: number, points: Array<{ x: number; y: number }>) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i]!
    const b = points[j]!
    const intersects = ((a.y > y) !== (b.y > y)) && (x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x)
    if (intersects) inside = !inside
  }
  return inside
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

function openingColor(type: WallOpening2D['type']) {
  if (type === 'door') return '#a16207'
  if (type === 'window') return '#38bdf8'
  return '#facc15'
}

function drawWallMarker(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, type: WallOpening2D['type'], width = 16, selected = false) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  const w = Math.max(12, width)
  const h = 10
  ctx.strokeStyle = selected ? '#f8fafc' : openingColor(type)
  ctx.lineWidth = selected ? 5 : 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-w / 2, 0)
  ctx.lineTo(w / 2, 0)
  ctx.stroke()
  if (type === 'door') {
    ctx.beginPath()
    ctx.lineWidth = 1.5
    ctx.arc(-w / 2, 0, h, -Math.PI / 2, 0)
    ctx.stroke()
  }
  ctx.restore()
}

function openingFromPointer(type: WallOpening2D['type'], wallIdx: number, wall: Wall2D, point: { x: number; y: number }): WallOpening2D | null {
  const constrained = computeWallConstrainedOpening(wall, point, openingWidthForType(type))
  if (!constrained) return null
  return { ...constrained, type, wallIdx }
}

export function Canvas2DViewer({
  walls,
  rooms,
  openings = [],
  devices,
  selectedWallIdx,
  selectedRoomIdx,
  selectedOpeningIdx,
  selectedDeviceIdx,
  editMode,
  visibleLayers,
  layerVisibility = {},
  layerOpacity = {},
  showEndpoints = true,
  onSelectWall,
  onSelectRoom,
  onSelectOpening,
  onSelectDevice,
  onDrawWall,
  onDrawWalls,
  onDeleteAt,
  onDeleteOpening,
  onUpdateWall,
  onMoveWallEndpoint,
  onBeginEdit,
  onFinishMoveWall,
  onAddDevice,
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
  const interactionTransformRef = useRef<{ scale: number; ox: number; oy: number } | null>(null)

  // ── Base scale computed from content bounds ──
  const roomXs = rooms.flatMap((room) => room.points?.map((point) => point.x) ?? [room.x, room.x + room.w])
  const roomYs = rooms.flatMap((room) => room.points?.map((point) => point.y) ?? [room.y, room.y + room.h])
  const worldXs = [...walls.flatMap((w) => [w.x1, w.x2]), ...roomXs, ...devices.map((d) => d.x)]
  const worldYs = [...walls.flatMap((w) => [w.y1, w.y2]), ...roomYs, ...devices.map((d) => d.y)]
  const minX = worldXs.length > 0 ? Math.min(...worldXs) : 0
  const maxX = worldXs.length > 0 ? Math.max(...worldXs) : 1
  const minY = worldYs.length > 0 ? Math.min(...worldYs) : 0
  const maxY = worldYs.length > 0 ? Math.max(...worldYs) : 1
  const contentWidth = Math.max(maxX - minX, 1)
  const contentHeight = Math.max(maxY - minY, 1)
  const baseScale = Math.min((width - PADDING * 2) / contentWidth, (height - PADDING * 2) / contentHeight)
  const baseOx = (width - contentWidth * baseScale) / 2 - minX * baseScale
  const baseOy = (height - contentHeight * baseScale) / 2 - minY * baseScale

  // Effective transform (base × camera)
  const effectiveScale = baseScale * cameraZoom
  const effectiveOx = baseOx + cameraOffset.x
  const effectiveOy = baseOy + cameraOffset.y

  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({ x: (sx - effectiveOx) / effectiveScale, y: (sy - effectiveOy) / effectiveScale }),
    [effectiveOx, effectiveOy, effectiveScale],
  )
  const screenToWorldDuringInteraction = useCallback(
    (sx: number, sy: number) => {
      const locked = interactionTransformRef.current
      if (!locked) return screenToWorld(sx, sy)
      return { x: (sx - locked.ox) / locked.scale, y: (sy - locked.oy) / locked.scale }
    },
    [screenToWorld],
  )

  // Drag state
  const [dragInfo, setDragInfo] = useState<{
    wallIdx: number
    startMouse: { x: number; y: number }
    startWall: Wall2D
  } | null>(null)
  const [endpointDragInfo, setEndpointDragInfo] = useState<{
    wallIdx: number
    endpoint: 'start' | 'end'
  } | null>(null)

  // Drawing preview state
  const drawStartRef = useRef<{ x: number; y: number } | null>(null)
  const [drawLine, setDrawLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  // Room drawing state
  const roomStartRef = useRef<{ x: number; y: number } | null>(null)
  const [roomDrag, setRoomDrag] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const [openingPreview, setOpeningPreview] = useState<WallOpening2D | null>(null)
  const [openingCursorPreview, setOpeningCursorPreview] = useState<OpeningCursorPreview | null>(null)

  // Snap preview
  const [snapPointVisible, setSnapPointVisible] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    drawStartRef.current = null
    roomStartRef.current = null
    setDrawLine(null)
    setRoomDrag(null)
    setOpeningPreview(null)
    setOpeningCursorPreview(null)
    setSnapPointVisible(null)
    setDragInfo(null)
    setEndpointDragInfo(null)
  }, [editMode])

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
    if (visibleLayers.grid && gridStep > 0.001) {
      ctx.globalAlpha = layerOpacity.grid ?? 1
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
      ctx.globalAlpha = 1
    }

    // ── Rooms ──
    if (visibleLayers.rooms) {
      ctx.globalAlpha = layerOpacity.rooms ?? 1
      for (const [i, room] of rooms.entries()) {
        const isSel = i === selectedRoomIdx
        ctx.fillStyle = isSel ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148, 163, 184, 0.06)'
        ctx.strokeStyle = isSel ? '#38bdf8' : 'rgba(148, 163, 184, 0.25)'
        ctx.lineWidth = isSel ? 2 : 1
        if (room.points && room.points.length >= 3) {
          ctx.beginPath()
          room.points.forEach((point, pointIndex) => {
            const sx = effectiveOx + point.x * effectiveScale
            const sy = effectiveOy + point.y * effectiveScale
            if (pointIndex === 0) ctx.moveTo(sx, sy)
            else ctx.lineTo(sx, sy)
          })
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
        } else {
          const rx = effectiveOx + room.x * effectiveScale
          const ry = effectiveOy + room.y * effectiveScale
          const rw = room.w * effectiveScale
          const rh = room.h * effectiveScale
          ctx.fillRect(rx, ry, rw, rh)
          ctx.strokeRect(rx, ry, rw, rh)
        }
        if (room.label) {
          ctx.fillStyle = '#94a3b8'
          ctx.font = '12px Inter, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(room.label, effectiveOx + (room.x + room.w / 2) * effectiveScale, effectiveOy + (room.y + room.h / 2) * effectiveScale + 4)
        }
      }
      ctx.globalAlpha = 1
    }

    if (visibleLayers.heatmap && rooms.length > 0) {
      ctx.globalAlpha = layerOpacity.heatmap ?? 0.5
      for (const [i, room] of rooms.entries()) {
        const intensity = 0.18 + (i % 4) * 0.08
        ctx.fillStyle = `rgba(251, 113, 133, ${intensity})`
        if (room.points && room.points.length >= 3) {
          ctx.beginPath()
          room.points.forEach((point, pointIndex) => {
            const sx = effectiveOx + point.x * effectiveScale
            const sy = effectiveOy + point.y * effectiveScale
            if (pointIndex === 0) ctx.moveTo(sx, sy)
            else ctx.lineTo(sx, sy)
          })
          ctx.closePath()
          ctx.fill()
        } else {
          ctx.fillRect(effectiveOx + room.x * effectiveScale, effectiveOy + room.y * effectiveScale, room.w * effectiveScale, room.h * effectiveScale)
        }
      }
      ctx.globalAlpha = 1
    }

    // ── Walls ──
    if (visibleLayers.walls) {
      ctx.globalAlpha = layerOpacity.walls ?? 1
      for (const [i, w] of walls.entries()) {
        const isSel = i === selectedWallIdx
        ctx.beginPath()
        ctx.moveTo(effectiveOx + w.x1 * effectiveScale, effectiveOy + w.y1 * effectiveScale)
        ctx.lineTo(effectiveOx + w.x2 * effectiveScale, effectiveOy + w.y2 * effectiveScale)
        ctx.strokeStyle = isSel ? '#38bdf8' : '#90a4ae'
        ctx.lineWidth = isSel ? 5 : 3
        ctx.lineCap = 'round'
        ctx.stroke()
        if (showEndpoints || isSel) {
          for (const pt of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
            ctx.beginPath()
            ctx.arc(effectiveOx + pt.x * effectiveScale, effectiveOy + pt.y * effectiveScale, 5, 0, Math.PI * 2)
            ctx.fillStyle = '#38bdf8'
            ctx.fill()
            ctx.strokeStyle = 'rgba(17, 17, 19, 0.9)'
            ctx.lineWidth = 1.5
            ctx.stroke()
          }
        }
      }
      ctx.globalAlpha = 1
    }

    if (visibleLayers.openings) {
      for (const [openingIdx, opening] of openings.entries()) {
      const openingLayer = openingLayerId(opening.type)
      if (layerVisibility[openingLayer] === false) continue
      ctx.globalAlpha = layerOpacity[openingLayer] ?? 1
      const wall = walls[opening.wallIdx]
      if (!wall) continue
      const point = nearestPointOnWall(
        wall.x1 + (wall.x2 - wall.x1) * opening.position,
        wall.y1 + (wall.y2 - wall.y1) * opening.position,
        wall,
      )
      const { angle } = getWallAngleAndCenter(wall.x1, wall.y1, wall.x2, wall.y2)
      drawWallMarker(
        ctx,
        effectiveOx + point.x * effectiveScale,
        effectiveOy + point.y * effectiveScale,
        angle,
        opening.type,
        opening.width * effectiveScale,
        openingIdx === selectedOpeningIdx,
      )
      if (showEndpoints) {
        const dx = Math.cos(angle) * (opening.width * effectiveScale) / 2
        const dy = Math.sin(angle) * (opening.width * effectiveScale) / 2
        for (const end of [{ x: effectiveOx + point.x * effectiveScale - dx, y: effectiveOy + point.y * effectiveScale - dy }, { x: effectiveOx + point.x * effectiveScale + dx, y: effectiveOy + point.y * effectiveScale + dy }]) {
          ctx.beginPath()
          ctx.arc(end.x, end.y, 3.5, 0, Math.PI * 2)
          ctx.fillStyle = openingColor(opening.type)
          ctx.fill()
        }
      }
      }
      ctx.globalAlpha = 1
    }

    if (visibleLayers.openings && openingPreview && layerVisibility[openingLayerId(openingPreview.type)] !== false) {
      ctx.globalAlpha = layerOpacity[openingLayerId(openingPreview.type)] ?? 1
      const wall = walls[openingPreview.wallIdx]
      if (wall) {
        const point = nearestPointOnWall(
          wall.x1 + (wall.x2 - wall.x1) * openingPreview.position,
          wall.y1 + (wall.y2 - wall.y1) * openingPreview.position,
          wall,
        )
        const { angle } = getWallAngleAndCenter(wall.x1, wall.y1, wall.x2, wall.y2)
        drawWallMarker(
          ctx,
          effectiveOx + point.x * effectiveScale,
          effectiveOy + point.y * effectiveScale,
          angle,
          openingPreview.type,
          openingPreview.width * effectiveScale,
        )
      }
      ctx.globalAlpha = 1
    }

    if (visibleLayers.openings && openingCursorPreview && layerVisibility[openingLayerId(openingCursorPreview.type)] !== false) {
      ctx.globalAlpha = layerOpacity[openingLayerId(openingCursorPreview.type)] ?? 1
      drawWallMarker(
        ctx,
        effectiveOx + openingCursorPreview.x * effectiveScale,
        effectiveOy + openingCursorPreview.y * effectiveScale,
        openingCursorPreview.angle,
        openingCursorPreview.type,
        openingCursorPreview.width * effectiveScale,
      )
      ctx.globalAlpha = 1
    }

    // ── Devices ──
    if (visibleLayers.devices) {
      for (const [i, d] of devices.entries()) {
        const opacityKey = d.device_type === 'camera' ? 'cameras' : d.device_type === 'sensor' ? 'sensors' : d.device_type === 'alarm' ? 'alarms' : 'access'
        if (layerVisibility[opacityKey] === false) continue
        ctx.globalAlpha = layerOpacity[opacityKey] ?? 1
        const cx = effectiveOx + d.x * effectiveScale
        const cy = effectiveOy + d.y * effectiveScale
        drawDevice(ctx, d.device_type, cx, cy, i === selectedDeviceIdx)
        ctx.fillStyle = '#94a3b8'
        ctx.font = '10px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(d.name, cx, cy + 20)
        ctx.globalAlpha = 1
      }
    }

    if (visibleLayers.coverage) {
      ctx.globalAlpha = layerOpacity.coverage ?? 0.5
      for (const d of devices) {
        const opacityKey = d.device_type === 'camera' ? 'cameras' : d.device_type === 'sensor' ? 'sensors' : d.device_type === 'alarm' ? 'alarms' : 'access'
        if (layerVisibility[opacityKey] === false) continue
        if (d.device_type !== 'camera' && d.device_type !== 'sensor') continue
        const cx = effectiveOx + d.x * effectiveScale
        const cy = effectiveOy + d.y * effectiveScale
        const radius = (d.device_type === 'camera' ? 4.5 : 2.8) * effectiveScale
        const gradient = ctx.createRadialGradient(cx, cy, 4, cx, cy, radius)
        gradient.addColorStop(0, d.device_type === 'camera' ? 'rgba(56, 189, 248, 0.28)' : 'rgba(34, 197, 94, 0.26)')
        gradient.addColorStop(1, 'rgba(56, 189, 248, 0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    if (visibleLayers.pathway && devices.length >= 2) {
      const pathDevices = devices.filter((device) => layerVisibility[device.device_type === 'camera' ? 'cameras' : device.device_type === 'sensor' ? 'sensors' : device.device_type === 'alarm' ? 'alarms' : 'access'] !== false)
      if (pathDevices.length >= 2) {
        ctx.globalAlpha = layerOpacity.pathway ?? 0.5
        ctx.beginPath()
        pathDevices.forEach((device, index) => {
          const x = effectiveOx + device.x * effectiveScale
          const y = effectiveOy + device.y * effectiveScale
          if (index === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.strokeStyle = '#22d3ee'
        ctx.lineWidth = 2
        ctx.setLineDash([8, 7])
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
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
    walls, rooms, openings, devices, selectedWallIdx, selectedRoomIdx, selectedOpeningIdx, selectedDeviceIdx, editMode, visibleLayers, layerVisibility, layerOpacity,
    drawLine, snapPointVisible, dragInfo, endpointDragInfo, roomDrag, openingPreview, openingCursorPreview, showEndpoints, width, height, maxX, maxY, baseScale, baseOx, baseOy,
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
      const endpointHit = showEndpoints && visibleLayers.walls && layerVisibility.walls !== false
        ? findNearestEndpoint(wPos.x, wPos.y, walls, effectiveScale)
        : null
      if (endpointHit) {
        onSelectWall?.(endpointHit.wallIdx)
        onBeginEdit?.()
        interactionTransformRef.current = { scale: effectiveScale, ox: effectiveOx, oy: effectiveOy }
        setEndpointDragInfo({ wallIdx: endpointHit.wallIdx, endpoint: endpointHit.endpoint })
        return
      }
      const selectableOpenings = visibleLayers.openings
        ? openings.map((opening, index) => ({ opening, index })).filter(({ opening }) => layerVisibility[openingLayerId(opening.type)] !== false)
        : []
      const localOpeningIdx = findOpeningIdx(wPos.x, wPos.y, walls, selectableOpenings.map(({ opening }) => opening), effectiveScale)
      const openingIdx = localOpeningIdx >= 0 ? selectableOpenings[localOpeningIdx]!.index : -1
      if (openingIdx >= 0) {
        onSelectOpening?.(openingIdx)
        return
      }
      const wIdx = visibleLayers.walls && layerVisibility.walls !== false
        ? findNearestWallIdx(wPos.x, wPos.y, walls, effectiveScale)
        : -1
      if (wIdx >= 0) {
        onSelectWall?.(wIdx)
        onBeginEdit?.()
        interactionTransformRef.current = { scale: effectiveScale, ox: effectiveOx, oy: effectiveOy }
        setDragInfo({
          wallIdx: wIdx,
          startMouse: { x: pos.x, y: pos.y },
          startWall: { ...walls[wIdx]! },
        })
        return
      }
      const rIdx = visibleLayers.rooms && layerVisibility.rooms !== false ? findRoomIdx(wPos.x, wPos.y, rooms) : -1
      if (rIdx >= 0) {
        onSelectRoom?.(rIdx)
      } else {
        const dIdx = visibleLayers.devices
          ? devices.findIndex((d) => layerVisibility[deviceLayerId(d.device_type)] !== false && Math.hypot(wPos.x - d.x, wPos.y - d.y) < 0.5)
          : -1
        if (dIdx >= 0) {
          onSelectDevice?.(dIdx)
        } else {
          onSelectWall?.(-1)
          onSelectRoom?.(-1)
          onSelectOpening?.(-1)
          onSelectDevice?.(-1)
        }
      }
    }

    if (editMode === 'wall') {
      const snapped = wPos
      if (!drawStartRef.current) {
        drawStartRef.current = snapped
        setDrawLine({ x1: snapped.x, y1: snapped.y, x2: snapped.x, y2: snapped.y })
      } else {
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
    }

    if (editMode === 'room') {
      const start = roomStartRef.current
      if (!start) {
        roomStartRef.current = { x: wPos.x, y: wPos.y }
        setRoomDrag({ startX: wPos.x, startY: wPos.y, currentX: wPos.x, currentY: wPos.y })
      } else {
        const dx = Math.abs(wPos.x - start.x)
        const dy = Math.abs(wPos.y - start.y)
        if (dx > MIN_SEGMENT_LENGTH && dy > MIN_SEGMENT_LENGTH) {
          const x = Math.min(start.x, wPos.x)
          const y = Math.min(start.y, wPos.y)
          onDrawWalls?.([
            { x1: x, y1: y, x2: x + dx, y2: y },
            { x1: x + dx, y1: y, x2: x + dx, y2: y + dy },
            { x1: x + dx, y1: y + dy, x2: x, y2: y + dy },
            { x1: x, y1: y + dy, x2: x, y2: y },
          ])
        }
        roomStartRef.current = null
        setRoomDrag(null)
        setSnapPointVisible(null)
      }
    }

    if (editMode === 'door' || editMode === 'window' || editMode === 'opening') {
      const wIdx = openingPreview?.type === editMode ? openingPreview.wallIdx : findOpeningWallIdx(wPos.x, wPos.y, walls, effectiveScale)
      if (wIdx >= 0) {
        const wall = walls[wIdx]!
        const opening = openingFromPointer(editMode, wIdx, wall, wPos)
        if (opening) onAddOpening?.(opening)
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
    if (editMode === 'select' && endpointDragInfo) {
      const raw = screenToWorldDuringInteraction(pos.x, pos.y)
      onMoveWallEndpoint?.(endpointDragInfo.wallIdx, endpointDragInfo.endpoint, raw.x, raw.y, false)
      setSnapPointVisible(null)
      return
    }

    if (editMode === 'select' && dragInfo) {
      const scale = interactionTransformRef.current?.scale ?? effectiveScale
      const dx = (pos.x - dragInfo.startMouse.x) / scale
      const dy = (pos.y - dragInfo.startMouse.y) / scale
      onUpdateWall?.(dragInfo.wallIdx, {
        x1: dragInfo.startWall.x1 + dx,
        y1: dragInfo.startWall.y1 + dy,
        x2: dragInfo.startWall.x2 + dx,
        y2: dragInfo.startWall.y2 + dy,
      }, false)
      return
    }

    // Drawing preview with snap
    if (editMode === 'wall' && drawStartRef.current) {
      const raw = screenToWorld(pos.x, pos.y)
      setDrawLine({
        x1: drawStartRef.current.x,
        y1: drawStartRef.current.y,
        x2: raw.x,
        y2: raw.y,
      })
      setSnapPointVisible(null)
      return
    }

    // Room drag preview
    if (editMode === 'room' && roomDrag) {
      const raw = screenToWorld(pos.x, pos.y)
      setRoomDrag((prev) => prev ? { ...prev, currentX: raw.x, currentY: raw.y } : null)
      setSnapPointVisible(null)
      return
    }

    if (editMode === 'door' || editMode === 'window' || editMode === 'opening') {
      const wIdx = findOpeningWallIdx(wPos.x, wPos.y, walls, effectiveScale)
      if (wIdx >= 0) {
        const wall = walls[wIdx]!
        const { angle } = getWallAngleAndCenter(wall.x1, wall.y1, wall.x2, wall.y2)
        setOpeningPreview(openingFromPointer(editMode, wIdx, wall, wPos))
        setOpeningCursorPreview({
          type: editMode,
          x: wPos.x,
          y: wPos.y,
          angle,
          width: openingCursorWidthForType(editMode),
        })
      } else {
        setOpeningPreview(null)
        setOpeningCursorPreview(null)
      }
      return
    }

    // Hover snap
    if (editMode === 'device' && snapPoint) {
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

    if (editMode === 'select' && endpointDragInfo) {
      const raw = screenToWorldDuringInteraction(pos.x, pos.y)
      onMoveWallEndpoint?.(endpointDragInfo.wallIdx, endpointDragInfo.endpoint, raw.x, raw.y, true)
      setEndpointDragInfo(null)
      interactionTransformRef.current = null
      setSnapPointVisible(null)
      return
    }

    // Finish wall drag
    if (editMode === 'select' && dragInfo) {
      const wall = walls[dragInfo.wallIdx]
      if (wall) {
        onFinishMoveWall?.(dragInfo.wallIdx, wall.x1, wall.y1, wall.x2, wall.y2)
      }
      setDragInfo(null)
      interactionTransformRef.current = null
      return
    }

    // Delete mode
    if (editMode === 'delete') {
      const wPos = screenToWorld(pos.x, pos.y)
      const selectableOpenings = visibleLayers.openings
        ? openings.map((opening, index) => ({ opening, index })).filter(({ opening }) => layerVisibility[openingLayerId(opening.type)] !== false)
        : []
      const localOpeningIdx = findOpeningIdx(wPos.x, wPos.y, walls, selectableOpenings.map(({ opening }) => opening), effectiveScale)
      const openingIdx = localOpeningIdx >= 0 ? selectableOpenings[localOpeningIdx]!.index : -1
      if (openingIdx >= 0) {
        onSelectOpening?.(openingIdx)
        onDeleteOpening?.(openingIdx)
        return
      }
      const wIdx = visibleLayers.walls && layerVisibility.walls !== false
        ? findNearestWallIdx(wPos.x, wPos.y, walls, effectiveScale)
        : -1
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
    setEndpointDragInfo(null)
    interactionTransformRef.current = null
    roomStartRef.current = null
    setRoomDrag(null)
    setOpeningPreview(null)
    setOpeningCursorPreview(null)
  }

  // ── Mouse wheel zoom ──
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
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
    editMode === 'wall' || editMode === 'device' || editMode === 'room' || editMode === 'door' || editMode === 'window' || editMode === 'opening' ? 'crosshair' :
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
