import { create } from 'zustand'
import type { Wall2D, Room2D } from '../components/Canvas2DViewer'

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
}

type SnapMode = 'grid' | 'endpoint' | 'both' | 'none'

type State = {
  mode: EditMode
  walls: Wall2D[]
  rooms: Room2D[]
  selectedWallIdx: number | null
  selectedRoomIdx: number | null
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
  moveWall: (idx: number, dx: number, dy: number) => void
  updateWall: (idx: number, wall: Partial<Wall2D>) => void
  selectWall: (idx: number | null) => void
  selectRoom: (idx: number | null) => void
  clearSelection: () => void
  deleteWallAt: (worldX: number, worldY: number) => void
  addRoom: (room: Room2D) => void
  loadSample: () => void
  selectDevice: (idx: number | null) => void
  addDevice: (device: SecurityDevice) => void
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
  loadEditorState: (state: Partial<Pick<State, 'walls' | 'rooms' | 'devices' | 'visibleLayers' | 'snapMode'>>) => void
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

function snapshot(state: State): HistoryEntry {
  return {
    walls: state.walls.map((w) => ({ ...w })),
    rooms: state.rooms.map((r) => ({ ...r })),
    devices: state.devices.map((d) => ({ ...d })),
  }
}

export const useEditorStore = create<State & Actions>((set, get) => ({
  mode: 'select',
  walls: [],
  rooms: [],
  devices: [],
  selectedWallIdx: null,
  selectedRoomIdx: null,
  selectedDeviceIdx: null,
  snapMode: 'both',
  visibleLayers: { walls: true, rooms: true, devices: true },
  history: [],
  historyIdx: -1,

  setMode: (mode) => set({ mode, selectedWallIdx: null, selectedRoomIdx: null, selectedDeviceIdx: null }),
  addWall: (x1, y1, x2, y2) => {
    get().pushHistory()
    set((s) => ({ walls: [...s.walls, { x1, y1, x2, y2 }] }))
  },

  moveWall: (idx, dx, dy) => {
    set((s) => {
      const walls = [...s.walls]
      if (idx >= 0 && idx < walls.length) {
        const w = walls[idx]!
        walls[idx] = { x1: w.x1 + dx, y1: w.y1 + dy, x2: w.x2 + dx, y2: w.y2 + dy }
      }
      return { walls }
    })
  },

  updateWall: (idx, partial) => {
    set((s) => {
      const walls = [...s.walls]
      if (idx >= 0 && idx < walls.length) {
        walls[idx] = { ...walls[idx]!, ...partial } as Wall2D
      }
      return { walls }
    })
  },

  selectWall: (idx) => set({ selectedWallIdx: idx, selectedRoomIdx: null, selectedDeviceIdx: null }),
  selectRoom: (idx) => set({ selectedRoomIdx: idx, selectedWallIdx: null, selectedDeviceIdx: null }),
  clearSelection: () => set({ selectedWallIdx: null, selectedRoomIdx: null, selectedDeviceIdx: null }),

  deleteWallAt: (_wx, _wy) => {
    const { walls, selectedWallIdx } = get()
    if (selectedWallIdx !== null && selectedWallIdx < walls.length) {
      get().pushHistory()
      set({
        walls: walls.filter((_, i) => i !== selectedWallIdx),
        selectedWallIdx: null,
      })
    }
  },

  addRoom: (room) => {
    get().pushHistory()
    set((s) => ({ rooms: [...s.rooms, room] }))
  },

  // Device actions
  selectDevice: (idx) => set({ selectedDeviceIdx: idx, selectedWallIdx: null, selectedRoomIdx: null }),
  addDevice: (device) => {
    get().pushHistory()
    set((s) => ({ devices: [...s.devices, device] }))
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
      devices: [],
      selectedWallIdx: null,
      selectedRoomIdx: null,
      selectedDeviceIdx: null,
      history: [],
      historyIdx: -1,
    }),

  clearAll: () =>
    set({
      walls: [],
      rooms: [],
      devices: [],
      selectedWallIdx: null,
      selectedRoomIdx: null,
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
      historyIdx: historyIdx + 1,
    })
  },

  loadEditorState: (state) => {
    set((current) => ({
      walls: state.walls?.map((wall) => ({ ...wall })) ?? current.walls,
      rooms: state.rooms?.map((room) => ({ ...room })) ?? current.rooms,
      devices: state.devices?.map((device) => ({ ...device })) ?? current.devices,
      visibleLayers: state.visibleLayers ? { ...state.visibleLayers } : current.visibleLayers,
      snapMode: state.snapMode ?? current.snapMode,
      selectedWallIdx: null,
      selectedRoomIdx: null,
      selectedDeviceIdx: null,
      history: [],
      historyIdx: -1,
    }))
  },
}))
