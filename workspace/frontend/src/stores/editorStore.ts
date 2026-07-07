import { create } from 'zustand'
import type { Wall2D, Room2D } from '../components/Canvas2DViewer'

export type EditMode = 'select' | 'wall' | 'delete'

type State = {
  mode: EditMode
  walls: Wall2D[]
  rooms: Room2D[]
  selectedWallIdx: number | null
}

type Actions = {
  setMode: (mode: EditMode) => void
  addWall: (x1: number, y1: number, x2: number, y2: number) => void
  selectWall: (idx: number) => void
  clearSelection: () => void
  deleteWallAt: (worldX: number, worldY: number) => void
  loadSample: () => void
  clearAll: () => void
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

export const useEditorStore = create<State & Actions>((set, get) => ({
  mode: 'select',
  walls: [],
  rooms: [],
  selectedWallIdx: null,

  setMode: (mode) => set({ mode, selectedWallIdx: null }),

  addWall: (x1, y1, x2, y2) => {
    set((s) => ({ walls: [...s.walls, { x1, y1, x2, y2 }] }))
  },

  selectWall: (idx) => set({ selectedWallIdx: idx }),

  clearSelection: () => set({ selectedWallIdx: null }),

  deleteWallAt: (_wx, _wy) => {
    const { walls, selectedWallIdx } = get()
    if (selectedWallIdx !== null && selectedWallIdx < walls.length) {
      set({
        walls: walls.filter((_, i) => i !== selectedWallIdx),
        selectedWallIdx: null,
      })
    }
  },

  loadSample: () => set({ walls: [...SAMPLE_WALLS], rooms: [...SAMPLE_ROOMS], selectedWallIdx: null }),

  clearAll: () => set({ walls: [], rooms: [], selectedWallIdx: null }),
}))
