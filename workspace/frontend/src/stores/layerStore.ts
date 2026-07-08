import { create } from 'zustand'

export type LayerCategory = 'devices' | 'analysis' | 'basic'

export interface LayerConfig {
  id: string
  label: string
  category: LayerCategory
  visible: boolean
  opacity: number
  color?: string
}

export interface LayerCategoryInfo {
  id: LayerCategory
  label: string
  labelEn: string
  icon: string
}

export const LAYER_CATEGORIES: LayerCategoryInfo[] = [
  { id: 'basic', label: '기본', labelEn: 'Basic', icon: '◈' },
  { id: 'devices', label: '장치', labelEn: 'Devices', icon: '◎' },
  { id: 'analysis', label: '분석', labelEn: 'Analysis', icon: '◉' },
]

export const DEFAULT_LAYERS: LayerConfig[] = [
  // Basic layers
  { id: 'walls', label: '벽', category: 'basic', visible: true, opacity: 1, color: '#90a4ae' },
  { id: 'rooms', label: '공간', category: 'basic', visible: true, opacity: 0.8, color: '#3b82f6' },
  { id: 'floor-plan', label: '도면', category: 'basic', visible: true, opacity: 0.6, color: '#64748b' },
  { id: 'grid', label: '그리드', category: 'basic', visible: true, opacity: 0.4, color: '#94a3b8' },
  // Device layers
  { id: 'cameras', label: '카메라', category: 'devices', visible: true, opacity: 1, color: '#38bdf8' },
  { id: 'sensors', label: '센서', category: 'devices', visible: true, opacity: 1, color: '#22c55e' },
  { id: 'alarms', label: '알람', category: 'devices', visible: true, opacity: 1, color: '#ef4444' },
  { id: 'access', label: '출입', category: 'devices', visible: true, opacity: 1, color: '#facc15' },
  // Analysis layers
  { id: 'coverage', label: '커버리지', category: 'analysis', visible: false, opacity: 0.5, color: '#a78bfa' },
  { id: 'heatmap', label: '히트맵', category: 'analysis', visible: false, opacity: 0.5, color: '#fb7185' },
  { id: 'pathway', label: '이동경로', category: 'analysis', visible: false, opacity: 0.5, color: '#22d3ee' },
]

interface LayerState {
  layers: LayerConfig[]
  getLayer: (id: string) => LayerConfig | undefined
  setLayerVisibility: (id: string, visible: boolean) => void
  setLayerOpacity: (id: string, opacity: number) => void
  toggleLayer: (id: string) => void
  resetLayers: () => void
  getVisibleLayers: () => LayerConfig[]
  getLayersByCategory: (category: LayerCategory) => LayerConfig[]
}

export const useLayerStore = create<LayerState>((set, get) => ({
  layers: DEFAULT_LAYERS.map((l) => ({ ...l })),

  getLayer: (id) => get().layers.find((l) => l.id === id),

  setLayerVisibility: (id, visible) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, visible } : l)),
    })),

  setLayerOpacity: (id, opacity) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l)),
    })),

  toggleLayer: (id) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
    })),

  resetLayers: () =>
    set({ layers: DEFAULT_LAYERS.map((l) => ({ ...l })) }),

  getVisibleLayers: () => get().layers.filter((l) => l.visible),

  getLayersByCategory: (category) => get().layers.filter((l) => l.category === category),
}))
