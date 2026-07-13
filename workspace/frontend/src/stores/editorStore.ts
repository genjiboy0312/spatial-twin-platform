import { create } from 'zustand'
import type { Wall2D, Room2D, WallOpening2D } from '../components/Canvas2DViewer'

export type SecurityDeviceType = 'camera' | 'sensor' | 'alarm' | 'access'
export type SecurityDevice = {
  id: string
  x: number
  y: number
  device_type: SecurityDeviceType
  name: string
  angle?: number
}

export type EditMode = 'select' | 'wall' | 'delete' | 'device' | 'room' | 'door' | 'window' | 'opening'

export const GRID_SIZE = 1.0

export function snapToGrid(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE
}

export function snapToEndpoints(
  x: number,
  y: number,
  walls: Wall2D[],
  threshold = 0.5,
): { x: number; y: number } | null {
  for (const w of walls) {
    const pts = [
      { x: w.x1, y: w.y1 },
      { x: w.x2, y: w.y2 },
    ]
    for (const p of pts) {
      if (Math.hypot(x - p.x, y - p.y) < threshold) return p
    }
  }
  return null
}

export type HistoryEntry = {
  walls: Wall2D[]
  rooms: Room2D[]
  devices: SecurityDevice[]
  openings: WallOpening2D[]
}

type SnapMode = 'grid' | 'endpoint' | 'both' | 'none'

type State = {
  mode: EditMode
  walls: Wall2D[]
  rooms: Room2D[]
  openings: WallOpening2D[]
  selectedWallIdx: number | null
  selectedRoomIdx: number | null
  selectedOpeningIdx: number | null
  snapMode: SnapMode
  // Layer visibility
  visibleLayers: { walls: boolean; rooms: boolean; devices: boolean }
  // History
  history: HistoryEntry[]
  historyIdx: number
  selectedDeviceIdx: number | null
  devices: SecurityDevice[]
}

type Actions = {
  setMode: (mode: EditMode) => void
  addWall: (x1: number, y1: number, x2: number, y2: number) => void
  addWalls: (walls: Wall2D[]) => void
  moveWall: (idx: number, dx: number, dy: number) => void
  updateWall: (idx: number, wall: Partial<Wall2D>, recordHistory?: boolean) => void
  updateWallEndpoint: (idx: number, endpoint: 'start' | 'end', x: number, y: number, recordHistory?: boolean) => void
  selectWall: (idx: number | null) => void
  selectRoom: (idx: number | null) => void
  selectOpening: (idx: number | null) => void
  clearSelection: () => void
  deleteWallAt: (worldX: number, worldY: number) => void
  addRoom: (room: Room2D) => void
  updateRoom: (idx: number, room: Partial<Room2D>, recordHistory?: boolean) => void
  addOpening: (opening: WallOpening2D) => void
  updateOpening: (idx: number, opening: Partial<WallOpening2D>, recordHistory?: boolean) => void
  removeOpening: (idx: number) => void
  removeSelected: () => void
  loadSample: () => void
  selectDevice: (idx: number | null) => void
  addDevice: (device: SecurityDevice) => void
  updateDevice: (idx: number, device: Partial<SecurityDevice>, recordHistory?: boolean) => void
  removeDevice: (idx: number) => void
  clearAll: () => void
  // Snapping
  setSnapMode: (mode: SnapMode) => void
  snapPoint: (x: number, y: number) => { x: number; y: number }
  // Layers
  toggleLayer: (layer: 'walls' | 'rooms' | 'devices') => void
  // History
  undo: () => void
  redo: () => void
  pushHistory: () => void
  loadEditorState: (state: Partial<Pick<State, 'walls' | 'rooms' | 'devices' | 'openings' | 'visibleLayers' | 'snapMode'>>) => void
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

const SAMPLE_ROOMS: Room2D[] = [
  { x: 2, y: 2, w: 6, h: 5, label: 'Meeting' },
  { x: 9, y: 2, w: 5, h: 5, label: 'Office A' },
  { x: 2, y: 8, w: 5, h: 4, label: 'Office B' },
  { x: 8, y: 8, w: 6, h: 4, label: 'Server' },
]

const MAX_HISTORY = 50
const AUTO_ROOM_PREFIX = '자동 방'
const POINT_EPSILON = 0.001
const MERGE_THRESHOLD = 0.35
const GENERATED_ROOM_PREFIX = '자동 방'
const MAX_ROOM_CYCLE_POINTS = 10
const ROOM_ENDPOINT_CLUSTER = 0.04
const GENERATED_ROOM_LABEL = 'Room'
const CONNECTED_ENDPOINT_EPSILON = 0.02
const MIN_ROOM_AREA = 0.0004
const MIN_ROOM_SPAN = 0.02

function samePoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= POINT_EPSILON
}

function pointKey(x: number, y: number) {
  return `${Number(x.toFixed(3))}:${Number(y.toFixed(3))}`
}

function polygonArea(points: Array<{ x: number; y: number }>) {
  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    area += a.x * b.y - b.x * a.y
  }
  return area / 2
}

function polygonBounds(points: Array<{ x: number; y: number }>) {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

function pointOnSegment(
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  epsilon = 0.001,
) {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y)
  if (Math.abs(cross) > epsilon) return false

  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)
  if (dot < -epsilon) return false

  const lengthSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
  return dot <= lengthSq + epsilon
}

function pointInPolygonInclusive(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!
    const b = polygon[j]!
    if (pointOnSegment(point, a, b)) return true
    const intersects = ((a.y > point.y) !== (b.y > point.y)) && (point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x)
    if (intersects) inside = !inside
  }
  return inside
}

function polygonContainsPolygon(container: Array<{ x: number; y: number }>, inner: Array<{ x: number; y: number }>) {
  return inner.every((point) => pointInPolygonInclusive(point, container))
}

function filterMinimalRoomCycles(polygons: Array<Array<{ x: number; y: number }>>) {
  const kept: Array<Array<{ x: number; y: number }>> = []
  const sorted = polygons
    .slice()
    .sort((a, b) => Math.abs(polygonArea(a)) - Math.abs(polygonArea(b)))

  for (const polygon of sorted) {
    const area = Math.abs(polygonArea(polygon))
    const containsSmallerRoom = kept.some((room) => {
      const roomArea = Math.abs(polygonArea(room))
      return area > roomArea + MIN_ROOM_AREA && polygonContainsPolygon(polygon, room)
    })
    if (!containsSmallerRoom) kept.push(polygon)
  }

  return kept
}

function canonicalCycle(keys: string[]) {
  const rotations: string[] = []
  for (const variant of [keys, keys.slice().reverse()]) {
    for (let i = 0; i < variant.length; i += 1) {
      rotations.push([...variant.slice(i), ...variant.slice(0, i)].join('|'))
    }
  }
  return rotations.sort()[0] ?? keys.join('|')
}

function detectClosedRooms(walls: Wall2D[]): Room2D[] {
  const pointMap = new Map<string, { x: number; y: number }>()
  const adjacency = new Map<string, Set<string>>()
  const findClusteredPointKey = (x: number, y: number) => {
    for (const [key, point] of pointMap.entries()) {
      if (Math.hypot(point.x - x, point.y - y) <= ROOM_ENDPOINT_CLUSTER) return key
    }
    return null
  }
  const addPoint = (x: number, y: number) => {
    const key = findClusteredPointKey(x, y) ?? pointKey(x, y)
    if (!pointMap.has(key)) pointMap.set(key, { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) })
    if (!adjacency.has(key)) adjacency.set(key, new Set())
    return key
  }

  for (const wall of walls) {
    if (Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) <= POINT_EPSILON) continue
    const a = addPoint(wall.x1, wall.y1)
    const b = addPoint(wall.x2, wall.y2)
    adjacency.get(a)?.add(b)
    adjacency.get(b)?.add(a)
  }

  const cycles = new Map<string, Array<{ x: number; y: number }>>()
  for (const start of Array.from(pointMap.keys()).sort()) {
    const walk = (current: string, path: string[]) => {
      if (path.length > MAX_ROOM_CYCLE_POINTS) return
      for (const next of adjacency.get(current) ?? []) {
        if (next === start && path.length >= 3) {
          const key = canonicalCycle(path)
          if (!cycles.has(key)) {
            const points = path.map((item) => pointMap.get(item)).filter((item): item is { x: number; y: number } => item !== undefined)
            const area = polygonArea(points)
            if (Math.abs(area) >= MIN_ROOM_AREA) cycles.set(key, area < 0 ? points.slice().reverse() : points)
          }
          continue
        }
        if (path.includes(next)) continue
        walk(next, [...path, next])
      }
    }
    walk(start, [start])
  }

  return filterMinimalRoomCycles(Array.from(cycles.values()))
    .sort((a, b) => Math.abs(polygonArea(a)) - Math.abs(polygonArea(b)))
    .map((points, index) => ({ ...polygonBounds(points), points, label: `${GENERATED_ROOM_LABEL} ${index + 1}`, generated: true }))
    .filter((room) => room.w >= MIN_ROOM_SPAN && room.h >= MIN_ROOM_SPAN)
}

function syncGeneratedRooms(walls: Wall2D[], rooms: Room2D[]) {
  const manualRooms = rooms.filter((room) => !room.generated && !room.label?.startsWith(AUTO_ROOM_PREFIX) && !room.label?.startsWith(GENERATED_ROOM_PREFIX) && !room.label?.startsWith(GENERATED_ROOM_LABEL))
  const existingManualKeys = new Set(manualRooms.map((room) => `${pointKey(room.x, room.y)}:${pointKey(room.x + room.w, room.y + room.h)}`))
  const autoRooms = detectClosedRooms(walls).filter((room) => !existingManualKeys.has(`${pointKey(room.x, room.y)}:${pointKey(room.x + room.w, room.y + room.h)}`))
  return [...manualRooms, ...autoRooms]
}

function roomFromRectangleWalls(walls: Wall2D[], index: number): Room2D | null {
  if (walls.length !== 4) return null
  const xs = Array.from(new Set(walls.flatMap((wall) => [wall.x1, wall.x2]).map((value) => Number(value.toFixed(3))))).sort((a, b) => a - b)
  const ys = Array.from(new Set(walls.flatMap((wall) => [wall.y1, wall.y2]).map((value) => Number(value.toFixed(3))))).sort((a, b) => a - b)
  if (xs.length !== 2 || ys.length !== 2) return null
  const [x1, x2] = xs
  const [y1, y2] = ys
  if (x1 === undefined || x2 === undefined || y1 === undefined || y2 === undefined || x2 - x1 < MIN_ROOM_SPAN || y2 - y1 < MIN_ROOM_SPAN) return null
  return {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    points: [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }],
    label: `${GENERATED_ROOM_LABEL} ${index}`,
    generated: true,
  }
}

function findMergeTarget(walls: Wall2D[], moving: { x: number; y: number }, ignore: { wallIdx: number; endpoint: 'start' | 'end' }) {
  let nearest: { x: number; y: number; distance: number } | null = null
  for (const [wallIdx, wall] of walls.entries()) {
    const endpoints = [
      { endpoint: 'start' as const, x: wall.x1, y: wall.y1 },
      { endpoint: 'end' as const, x: wall.x2, y: wall.y2 },
    ]
    for (const candidate of endpoints) {
      if (wallIdx === ignore.wallIdx && candidate.endpoint === ignore.endpoint) continue
      const distance = Math.hypot(moving.x - candidate.x, moving.y - candidate.y)
      if (distance <= MERGE_THRESHOLD && (!nearest || distance < nearest.distance)) {
        nearest = { x: candidate.x, y: candidate.y, distance }
      }
    }
  }
  return nearest ? { x: nearest.x, y: nearest.y } : moving
}

function snapshot(state: State): HistoryEntry {
  return {
    walls: state.walls.map((w) => ({ ...w })),
    rooms: state.rooms.map((r) => ({ ...r })),
    devices: state.devices.map((d) => ({ ...d })),
    openings: state.openings.map((o) => ({ ...o })),
  }
}

export const useEditorStore = create<State & Actions>((set, get) => ({
  mode: 'select',
  walls: [],
  rooms: [],
  openings: [],
  devices: [],
  selectedWallIdx: null,
  selectedRoomIdx: null,
  selectedOpeningIdx: null,
  selectedDeviceIdx: null,
  snapMode: 'both',
  visibleLayers: { walls: true, rooms: true, devices: true },
  history: [],
  historyIdx: -1,

  setMode: (mode) => set({ mode, selectedWallIdx: null, selectedRoomIdx: null, selectedOpeningIdx: null, selectedDeviceIdx: null }),
  addWall: (x1, y1, x2, y2) => {
    get().pushHistory()
    set((s) => {
      const walls = [...s.walls, { x1, y1, x2, y2 }]
      return { walls, rooms: syncGeneratedRooms(walls, s.rooms) }
    })
  },

  addWalls: (nextWalls) => {
    if (nextWalls.length === 0) return
    get().pushHistory()
    set((s) => {
      const walls = [...s.walls, ...nextWalls]
      const rooms = syncGeneratedRooms(walls, s.rooms)
      const directRoom = roomFromRectangleWalls(nextWalls, rooms.length + 1)
      const hasDirectRoom = directRoom
        ? rooms.some((room) => pointKey(room.x, room.y) === pointKey(directRoom.x, directRoom.y) && pointKey(room.x + room.w, room.y + room.h) === pointKey(directRoom.x + directRoom.w, directRoom.y + directRoom.h))
        : true
      return { walls, rooms: directRoom && !hasDirectRoom ? [...rooms, directRoom] : rooms }
    })
  },

  moveWall: (idx, dx, dy) => {
    set((s) => {
      const walls = [...s.walls]
      if (idx >= 0 && idx < walls.length) {
        const w = walls[idx]!
        walls[idx] = { x1: w.x1 + dx, y1: w.y1 + dy, x2: w.x2 + dx, y2: w.y2 + dy }
      }
      return { walls, rooms: syncGeneratedRooms(walls, s.rooms) }
    })
  },

  updateWall: (idx, partial, recordHistory = true) => {
    if (recordHistory) get().pushHistory()
    set((s) => {
      const walls = [...s.walls]
      if (idx >= 0 && idx < walls.length) {
        walls[idx] = { ...walls[idx]!, ...partial } as Wall2D
      }
      return { walls, rooms: syncGeneratedRooms(walls, s.rooms) }
    })
  },

  updateWallEndpoint: (idx, endpoint, x, y, recordHistory = true) => {
    if (recordHistory) get().pushHistory()
    set((s) => {
      if (idx < 0 || idx >= s.walls.length) return {}
      const selectedWall = s.walls[idx]!
      const movingFrom = endpoint === 'start'
        ? { x: selectedWall.x1, y: selectedWall.y1 }
        : { x: selectedWall.x2, y: selectedWall.y2 }
      const merged = recordHistory ? findMergeTarget(s.walls, { x, y }, { wallIdx: idx, endpoint }) : { x, y }
      const walls = s.walls.map((wall) => {
        const next = { ...wall }
        const startConnected = Math.hypot(wall.x1 - movingFrom.x, wall.y1 - movingFrom.y) <= CONNECTED_ENDPOINT_EPSILON
        const endConnected = Math.hypot(wall.x2 - movingFrom.x, wall.y2 - movingFrom.y) <= CONNECTED_ENDPOINT_EPSILON
        if (startConnected) {
          next.x1 = merged.x
          next.y1 = merged.y
        }
        if (endConnected) {
          next.x2 = merged.x
          next.y2 = merged.y
        }
        return next
      })
      return { walls, rooms: syncGeneratedRooms(walls, s.rooms) }
    })
  },

  selectWall: (idx) => set({ selectedWallIdx: idx, selectedRoomIdx: null, selectedOpeningIdx: null, selectedDeviceIdx: null }),
  selectRoom: (idx) => set({ selectedRoomIdx: idx, selectedWallIdx: null, selectedOpeningIdx: null, selectedDeviceIdx: null }),
  selectOpening: (idx) => set({ selectedOpeningIdx: idx, selectedWallIdx: null, selectedRoomIdx: null, selectedDeviceIdx: null }),
  clearSelection: () => set({ selectedWallIdx: null, selectedRoomIdx: null, selectedOpeningIdx: null, selectedDeviceIdx: null }),

  deleteWallAt: (_wx, _wy) => {
    const { walls, selectedWallIdx } = get()
    if (selectedWallIdx !== null && selectedWallIdx < walls.length) {
      get().pushHistory()
      set({
        walls: walls.filter((_, i) => i !== selectedWallIdx),
        rooms: syncGeneratedRooms(walls.filter((_, i) => i !== selectedWallIdx), get().rooms),
        openings: get().openings
          .filter((opening) => opening.wallIdx !== selectedWallIdx)
          .map((opening) => ({
            ...opening,
            wallIdx: opening.wallIdx > selectedWallIdx ? opening.wallIdx - 1 : opening.wallIdx,
          })),
        selectedWallIdx: null,
        selectedOpeningIdx: null,
      })
    }
  },

  addRoom: (room) => {
    get().pushHistory()
    set((s) => ({ rooms: [...s.rooms, room] }))
  },

  updateRoom: (idx, partial, recordHistory = true) => {
    if (recordHistory) get().pushHistory()
    set((s) => {
      const rooms = [...s.rooms]
      if (idx >= 0 && idx < rooms.length) {
        rooms[idx] = { ...rooms[idx]!, ...partial } as Room2D
      }
      return { rooms }
    })
  },

  addOpening: (opening) => {
    get().pushHistory()
    set((s) => ({ openings: [...s.openings, opening], selectedOpeningIdx: s.openings.length, selectedWallIdx: null, selectedRoomIdx: null, selectedDeviceIdx: null }))
  },

  updateOpening: (idx, partial, recordHistory = true) => {
    if (recordHistory) get().pushHistory()
    set((s) => {
      const openings = [...s.openings]
      if (idx >= 0 && idx < openings.length) {
        openings[idx] = { ...openings[idx]!, ...partial } as WallOpening2D
      }
      return { openings }
    })
  },

  removeOpening: (idx) => {
    if (idx < 0 || idx >= get().openings.length) return
    get().pushHistory()
    set((s) => ({
      openings: s.openings.filter((_, i) => i !== idx),
      selectedOpeningIdx: null,
    }))
  },

  removeSelected: () => {
    const { selectedWallIdx, selectedRoomIdx, selectedOpeningIdx, selectedDeviceIdx, walls, rooms, openings, devices } = get()
    if (selectedOpeningIdx !== null && selectedOpeningIdx >= 0 && selectedOpeningIdx < openings.length) {
      get().removeOpening(selectedOpeningIdx)
      return
    }
    if (selectedDeviceIdx !== null && selectedDeviceIdx >= 0 && selectedDeviceIdx < devices.length) {
      get().removeDevice(selectedDeviceIdx)
      return
    }
    if (selectedWallIdx !== null && selectedWallIdx >= 0 && selectedWallIdx < walls.length) {
      get().pushHistory()
      set({
        walls: walls.filter((_, i) => i !== selectedWallIdx),
        rooms: syncGeneratedRooms(walls.filter((_, i) => i !== selectedWallIdx), rooms),
        openings: openings
          .filter((opening) => opening.wallIdx !== selectedWallIdx)
          .map((opening) => ({ ...opening, wallIdx: opening.wallIdx > selectedWallIdx ? opening.wallIdx - 1 : opening.wallIdx })),
        selectedWallIdx: null,
      })
      return
    }
    if (selectedRoomIdx !== null && selectedRoomIdx >= 0 && selectedRoomIdx < rooms.length) {
      get().pushHistory()
      set({ rooms: rooms.filter((_, i) => i !== selectedRoomIdx), selectedRoomIdx: null })
    }
  },

  // Device actions
  selectDevice: (idx) => set({ selectedDeviceIdx: idx, selectedWallIdx: null, selectedRoomIdx: null, selectedOpeningIdx: null }),
  addDevice: (device) => {
    get().pushHistory()
    set((s) => ({ devices: [...s.devices, device] }))
  },
  updateDevice: (idx, partial, recordHistory = true) => {
    if (recordHistory) get().pushHistory()
    set((s) => {
      const devices = [...s.devices]
      if (idx >= 0 && idx < devices.length) {
        devices[idx] = { ...devices[idx]!, ...partial }
      }
      return { devices }
    })
  },
  removeDevice: (idx) => {
    const { devices } = get()
    if (idx >= 0 && idx < devices.length) {
      get().pushHistory()
      set({ devices: devices.filter((_, i) => i !== idx), selectedDeviceIdx: null })
    }
  },

  loadSample: () =>
    set({
      walls: SAMPLE_WALLS.map((w) => ({ ...w })),
      rooms: SAMPLE_ROOMS.map((r) => ({ ...r })),
      openings: [],
      devices: [],
      selectedWallIdx: null,
      selectedRoomIdx: null,
      selectedOpeningIdx: null,
      selectedDeviceIdx: null,
      history: [],
      historyIdx: -1,
    }),

  clearAll: () =>
    set({
      walls: [],
      rooms: [],
      openings: [],
      devices: [],
      selectedWallIdx: null,
      selectedRoomIdx: null,
      selectedOpeningIdx: null,
      selectedDeviceIdx: null,
      history: [],
      historyIdx: -1,
    }),

  // Snapping
  setSnapMode: (snapMode) => set({ snapMode }),

  snapPoint: (x, y) => {
    const { snapMode, walls } = get()
    let result = { x, y }
    if (snapMode === 'grid' || snapMode === 'both') {
      result = { x: snapToGrid(x), y: snapToGrid(y) }
    }
    if (snapMode === 'endpoint' || snapMode === 'both') {
      const ep = snapToEndpoints(result.x, result.y, walls)
      if (ep) result = ep
    }
    return result
  },

  // Layers
  toggleLayer: (layer) =>
    set((s) => ({
      visibleLayers: { ...s.visibleLayers, [layer]: !s.visibleLayers[layer] },
    })),

  // History
  pushHistory: () => {
    set((s) => {
      const entry = snapshot(s)
      const newHistory = s.history.slice(0, s.historyIdx + 1)
      newHistory.push(entry)
      if (newHistory.length > MAX_HISTORY) newHistory.shift()
      return { history: newHistory, historyIdx: newHistory.length - 1 }
    })
  },

  undo: () => {
    const { history, historyIdx } = get()
    if (historyIdx < 0) return
    const entry = history[historyIdx]!
    set({
      walls: entry.walls.map((w) => ({ ...w })),
      rooms: entry.rooms.map((r) => ({ ...r })),
      devices: entry.devices.map((d) => ({ ...d })),
      openings: entry.openings.map((o) => ({ ...o })),
      historyIdx: historyIdx - 1,
    })
  },

  redo: () => {
    const { history, historyIdx } = get()
    if (historyIdx + 2 >= history.length) return
    const entry = history[historyIdx + 2]!
    set({
      walls: entry.walls.map((w) => ({ ...w })),
      rooms: entry.rooms.map((r) => ({ ...r })),
      devices: entry.devices.map((d) => ({ ...d })),
      openings: entry.openings.map((o) => ({ ...o })),
      historyIdx: historyIdx + 1,
    })
  },

  loadEditorState: (state) => {
    set((current) => ({
      walls: state.walls?.map((wall) => ({ ...wall })) ?? current.walls,
      rooms: (() => {
        const nextWalls = state.walls?.map((wall) => ({ ...wall })) ?? current.walls
        const nextRooms = state.rooms?.map((room) => ({ ...room })) ?? current.rooms
        return nextRooms.length > 0 ? nextRooms : syncGeneratedRooms(nextWalls, [])
      })(),
      devices: state.devices?.map((device) => ({ ...device })) ?? current.devices,
      openings: state.openings?.map((opening) => ({ ...opening })) ?? current.openings,
      visibleLayers: state.visibleLayers ? { ...state.visibleLayers } : current.visibleLayers,
      snapMode: state.snapMode ?? current.snapMode,
      selectedWallIdx: null,
      selectedRoomIdx: null,
      selectedOpeningIdx: null,
      selectedDeviceIdx: null,
      history: [],
      historyIdx: -1,
    }))
  },
}))
