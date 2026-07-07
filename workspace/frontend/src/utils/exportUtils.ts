import type { Wall2D, Room2D } from '../components/Canvas2DViewer'
import type { SecurityDevice } from '../stores/editorStore'

export type ExportSceneData = {
  walls: Wall2D[]
  rooms: Room2D[]
  devices: SecurityDevice[]
}

type Bounds2D = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const WALL_HEIGHT_METERS = 1.5
const WALL_THICKNESS_METERS = 0.08
const DEVICE_MARKER_SIZE_METERS = 0.22
const DEVICE_MARKER_WIDTH_METERS = 0.04
const DEVICE_DXF_RADIUS_METERS = 0.15
const PRINT_STYLE_ID = 'spatial-twin-export-print-style'

const DEVICE_DXF_LAYERS: Record<SecurityDevice['device_type'], string> = {
  camera: 'DEVICE_CAMERA',
  sensor: 'DEVICE_SENSOR',
  alarm: 'DEVICE_ALARM',
  access: 'DEVICE_ACCESS',
}

function formatNumber(value: number): string {
  const normalized = Math.abs(value) < 1e-9 ? 0 : value
  if (Number.isInteger(normalized)) return String(normalized)
  return normalized.toFixed(4).replace(/\.?0+$/, '')
}

function roomToBounds(room: Room2D): Bounds2D {
  return {
    minX: Math.min(room.x, room.x + room.w),
    minY: Math.min(room.y, room.y + room.h),
    maxX: Math.max(room.x, room.x + room.w),
    maxY: Math.max(room.y, room.y + room.h),
  }
}

function combineBounds(bounds: Bounds2D[]): Bounds2D {
  if (bounds.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 }

  return bounds.reduce(
    (acc, bound) => ({
      minX: Math.min(acc.minX, bound.minX),
      minY: Math.min(acc.minY, bound.minY),
      maxX: Math.max(acc.maxX, bound.maxX),
      maxY: Math.max(acc.maxY, bound.maxY),
    }),
    bounds[0]!,
  )
}

function getSceneBounds(walls: Wall2D[], rooms: Room2D[], devices: SecurityDevice[]): Bounds2D {
  const roomBounds = rooms.map(roomToBounds)
  const wallBounds = walls.map((wall) => ({
    minX: Math.min(wall.x1, wall.x2),
    minY: Math.min(wall.y1, wall.y2),
    maxX: Math.max(wall.x1, wall.x2),
    maxY: Math.max(wall.y1, wall.y2),
  }))
  const deviceBounds = devices.map((device) => ({
    minX: device.x,
    minY: device.y,
    maxX: device.x,
    maxY: device.y,
  }))

  return combineBounds([...roomBounds, ...wallBounds, ...deviceBounds])
}

function dxfPair(code: number, value: string | number): string[] {
  return [String(code), String(value)]
}

function appendDxfLine(lines: string[], layer: string, x1: number, y1: number, x2: number, y2: number): void {
  lines.push(
    ...dxfPair(0, 'LINE'),
    ...dxfPair(8, layer),
    ...dxfPair(10, formatNumber(x1)),
    ...dxfPair(20, formatNumber(y1)),
    ...dxfPair(30, 0),
    ...dxfPair(11, formatNumber(x2)),
    ...dxfPair(21, formatNumber(y2)),
    ...dxfPair(31, 0),
  )
}

function escapeCsvValue(value: string | number): string {
  const rawText = String(value)
  const text = /^[=+\-@\t\r]/.test(rawText) ? `'${rawText}` : rawText
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function findRoomLabel(device: SecurityDevice, rooms: Room2D[]): string {
  const room = rooms.find((candidate) => {
    const bounds = roomToBounds(candidate)
    return device.x >= bounds.minX && device.x <= bounds.maxX && device.y >= bounds.minY && device.y <= bounds.maxY
  })

  return room?.label ?? ''
}

export function exportToObj(walls: Wall2D[], rooms: Room2D[], devices: SecurityDevice[]): string {
  const lines: string[] = [
    '# Spatial Twin Building Editor OBJ export',
    `# Walls: ${walls.length}`,
    `# Rooms: ${rooms.length}`,
    `# Devices: ${devices.length}`,
    '# Units: meters',
    'o SpatialTwinBuilding',
  ]
  let vertexIndex = 1
  let normalIndex = 1

  const addVertex = (x: number, y: number, z: number): number => {
    lines.push(`v ${formatNumber(x)} ${formatNumber(y)} ${formatNumber(z)}`)
    const current = vertexIndex
    vertexIndex += 1
    return current
  }

  const addNormal = (x: number, y: number, z: number): number => {
    lines.push(`vn ${formatNumber(x)} ${formatNumber(y)} ${formatNumber(z)}`)
    const current = normalIndex
    normalIndex += 1
    return current
  }

  const addFace = (vertices: number[], normal: number): void => {
    lines.push(`f ${vertices.map((vertex) => `${vertex}//${normal}`).join(' ')}`)
  }

  const upNormal = addNormal(0, 1, 0)
  const downNormal = addNormal(0, -1, 0)
  const bounds = getSceneBounds(walls, rooms, devices)
  const floorVertices = [
    addVertex(bounds.minX, 0, bounds.minY),
    addVertex(bounds.minX, 0, bounds.maxY),
    addVertex(bounds.maxX, 0, bounds.maxY),
    addVertex(bounds.maxX, 0, bounds.minY),
  ]
  addFace(floorVertices, upNormal)

  for (const wall of walls) {
    const dx = wall.x2 - wall.x1
    const dz = wall.y2 - wall.y1
    const length = Math.hypot(dx, dz)
    if (length === 0) continue

    const offsetX = (-dz / length) * (WALL_THICKNESS_METERS / 2)
    const offsetZ = (dx / length) * (WALL_THICKNESS_METERS / 2)
    const sideNormal = addNormal(-dz / length, 0, dx / length)
    const oppositeSideNormal = addNormal(dz / length, 0, -dx / length)
    const startNormal = addNormal(-dx / length, 0, -dz / length)
    const endNormal = addNormal(dx / length, 0, dz / length)

    const bottomA = addVertex(wall.x1 + offsetX, 0, wall.y1 + offsetZ)
    const bottomB = addVertex(wall.x2 + offsetX, 0, wall.y2 + offsetZ)
    const bottomC = addVertex(wall.x2 - offsetX, 0, wall.y2 - offsetZ)
    const bottomD = addVertex(wall.x1 - offsetX, 0, wall.y1 - offsetZ)
    const topA = addVertex(wall.x1 + offsetX, WALL_HEIGHT_METERS, wall.y1 + offsetZ)
    const topB = addVertex(wall.x2 + offsetX, WALL_HEIGHT_METERS, wall.y2 + offsetZ)
    const topC = addVertex(wall.x2 - offsetX, WALL_HEIGHT_METERS, wall.y2 - offsetZ)
    const topD = addVertex(wall.x1 - offsetX, WALL_HEIGHT_METERS, wall.y1 - offsetZ)

    addFace([bottomA, bottomB, topB, topA], sideNormal)
    addFace([bottomC, bottomD, topD, topC], oppositeSideNormal)
    addFace([topA, topB, topC, topD], upNormal)
    addFace([bottomD, bottomC, bottomB, bottomA], downNormal)
    addFace([bottomD, bottomA, topA, topD], startNormal)
    addFace([bottomB, bottomC, topC, topB], endNormal)
  }

  for (const device of devices) {
    const halfLength = DEVICE_MARKER_SIZE_METERS / 2
    const halfWidth = DEVICE_MARKER_WIDTH_METERS / 2
    const height = 0.04

    const horizontal = [
      addVertex(device.x - halfLength, height, device.y - halfWidth),
      addVertex(device.x - halfLength, height, device.y + halfWidth),
      addVertex(device.x + halfLength, height, device.y + halfWidth),
      addVertex(device.x + halfLength, height, device.y - halfWidth),
    ]
    const vertical = [
      addVertex(device.x - halfWidth, height, device.y - halfLength),
      addVertex(device.x - halfWidth, height, device.y + halfLength),
      addVertex(device.x + halfWidth, height, device.y + halfLength),
      addVertex(device.x + halfWidth, height, device.y - halfLength),
    ]

    addFace(horizontal, upNormal)
    addFace(vertical, upNormal)
  }

  return `${lines.join('\n')}\n`
}

export function exportToDxf(walls: Wall2D[], rooms: Room2D[], devices: SecurityDevice[]): string {
  const lines: string[] = [
    ...dxfPair(0, 'SECTION'),
    ...dxfPair(2, 'HEADER'),
    ...dxfPair(9, '$ACADVER'),
    ...dxfPair(1, 'AC1009'),
    ...dxfPair(0, 'ENDSEC'),
    ...dxfPair(0, 'SECTION'),
    ...dxfPair(2, 'ENTITIES'),
  ]

  for (const wall of walls) {
    appendDxfLine(lines, 'WALLS', wall.x1, wall.y1, wall.x2, wall.y2)
  }

  for (const room of rooms) {
    const bounds = roomToBounds(room)
    const vertices: [number, number][] = [
      [bounds.minX, bounds.minY],
      [bounds.maxX, bounds.minY],
      [bounds.maxX, bounds.maxY],
      [bounds.minX, bounds.maxY],
    ]

    for (let index = 0; index < vertices.length; index++) {
      const [x1, y1] = vertices[index]!
      const [x2, y2] = vertices[(index + 1) % vertices.length]!
      appendDxfLine(lines, 'ROOMS', x1, y1, x2, y2)
    }
  }

  for (const device of devices) {
    lines.push(
      ...dxfPair(0, 'CIRCLE'),
      ...dxfPair(8, DEVICE_DXF_LAYERS[device.device_type]),
      ...dxfPair(10, formatNumber(device.x)),
      ...dxfPair(20, formatNumber(device.y)),
      ...dxfPair(30, 0),
      ...dxfPair(40, formatNumber(DEVICE_DXF_RADIUS_METERS)),
    )
  }

  lines.push(...dxfPair(0, 'ENDSEC'), ...dxfPair(0, 'EOF'))
  return `${lines.join('\n')}\n`
}

export function exportToCsv(devices: SecurityDevice[], rooms: Room2D[]): string {
  const header = ['id', 'name', 'device_type', 'x', 'y', 'angle', 'room_label']
  const rows = devices.map((device) => [
    device.id,
    device.name,
    device.device_type,
    formatNumber(device.x),
    formatNumber(device.y),
    device.angle === undefined ? '' : formatNumber(device.angle),
    findRoomLabel(device, rooms),
  ])

  return `${[header, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n')}\n`
}

export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  try {
    document.body.appendChild(link)
    link.click()
  } finally {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

function ensurePrintStylesheet(): void {
  if (document.getElementById(PRINT_STYLE_ID)) return

  const style = document.createElement('style')
  style.id = PRINT_STYLE_ID
  style.media = 'print'
  style.textContent = [
    '@page { margin: 12mm; }',
    'body { background: #fff !important; color: #000 !important; }',
    '.sidebar, .skip-link, button { display: none !important; }',
    '.content { padding: 0 !important; }',
    '.page-grid { display: block !important; max-width: none !important; }',
    '.viewer-container, .card { break-inside: avoid; }',
  ].join('\n')
  document.head.appendChild(style)
}

export function exportToPdf(): { print: () => void } {
  return {
    print: () => {
      ensurePrintStylesheet()
      window.print()
    },
  }
}
