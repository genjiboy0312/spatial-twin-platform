import { create } from 'zustand'

export type LayerCategory = 'devices' | 'analysis' | 'basic'
export type LayerId =
  | 'walls'
  | 'rooms'
  | 'doors'
  | 'windows'
  | 'passages'
  | 'floor-plan'
  | 'grid'
  | 'cameras'
  | 'sensors'
  | 'alarms'
  | 'access'
  | 'coverage'
  | 'heatmap'
  | 'pathway'

export interface LayerConfig {
  id: LayerId
  label: string
  labelEn: string
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
  { id: 'basic', label: '기본', labelEn: 'Basic', icon: '□' },
  { id: 'devices', label: '장치', labelEn: 'Devices', icon: '◇' },
  { id: 'analysis', label: '분석', labelEn: 'Analysis', icon: '◎' },
]

export const DEFAULT_LAYERS: LayerConfig[] = [
  { id: 'walls', label: '벽', labelEn: 'Walls', category: 'basic', visible: true, opacity: 1, color: '#90a4ae' },
  { id: 'rooms', label: '방 / 바닥', labelEn: 'Rooms / Floors', category: 'basic', visible: true, opacity: 0.8, color: '#3b82f6' },
  { id: 'doors', label: '문', labelEn: 'Doors', category: 'basic', visible: true, opacity: 1, color: '#8b5a2b' },
  { id: 'windows', label: '창문', labelEn: 'Windows', category: 'basic', visible: true, opacity: 1, color: '#7dd3fc' },
  { id: 'passages', label: '개구부', labelEn: 'Openings', category: 'basic', visible: true, opacity: 1, color: '#facc15' },
  { id: 'floor-plan', label: '도면', labelEn: 'Floor plan', category: 'basic', visible: true, opacity: 0.6, color: '#64748b' },
  { id: 'grid', label: '그리드', labelEn: 'Grid', category: 'basic', visible: true, opacity: 0.4, color: '#94a3b8' },
  { id: 'cameras', label: '카메라', labelEn: 'Cameras', category: 'devices', visible: true, opacity: 1, color: '#38bdf8' },
  { id: 'sensors', label: '센서', labelEn: 'Sensors', category: 'devices', visible: true, opacity: 1, color: '#22c55e' },
  { id: 'alarms', label: '알람', labelEn: 'Alarms', category: 'devices', visible: true, opacity: 1, color: '#ef4444' },
  { id: 'access', label: '출입', labelEn: 'Access', category: 'devices', visible: true, opacity: 1, color: '#facc15' },
  { id: 'coverage', label: '커버리지', labelEn: 'Coverage', category: 'analysis', visible: false, opacity: 0.5, color: '#a78bfa' },
  { id: 'heatmap', label: '히트맵', labelEn: 'Heatmap', category: 'analysis', visible: false, opacity: 0.5, color: '#fb7185' },
  { id: 'pathway', label: '이동 경로', labelEn: 'Pathway', category: 'analysis', visible: false, opacity: 0.5, color: '#22d3ee' },
]

function normalizeLayers(layers: Partial<LayerConfig>[] | undefined): LayerConfig[] {
  return DEFAULT_LAYERS.map((fallback) => {
    const saved = layers?.find((layer) => layer.id === fallback.id)
    return {
      ...fallback,
      visible: typeof saved?.visible === 'boolean' ? saved.visible : fallback.visible,
      opacity: typeof saved?.opacity === 'number' ? Math.max(0, Math.min(1, saved.opacity)) : fallback.opacity,
    }
  })
}

interface LayerState {
  layers: LayerConfig[]
  getLayer: (id: LayerId) => LayerConfig | undefined
  setLayerVisibility: (id: LayerId, visible: boolean) => void
  setLayerOpacity: (id: LayerId, opacity: number) => void
  setLayers: (layers: Partial<LayerConfig>[] | undefined) => void
  toggleLayer: (id: LayerId) => void
  resetLayers: () => void
  getVisibleLayers: () => LayerConfig[]
  getLayersByCategory: (category: LayerCategory) => LayerConfig[]
}

export const useLayerStore = create<LayerState>((set, get) => ({
  layers: DEFAULT_LAYERS.map((layer) => ({ ...layer })),

  getLayer: (id) => get().layers.find((layer) => layer.id === id),

  setLayerVisibility: (id, visible) =>
    set((state) => ({
      layers: state.layers.map((layer) => (layer.id === id ? { ...layer, visible } : layer)),
    })),

  setLayerOpacity: (id, opacity) =>
    set((state) => ({
      layers: state.layers.map((layer) => (layer.id === id ? { ...layer, opacity: Math.max(0, Math.min(1, opacity)) } : layer)),
    })),

  setLayers: (layers) => set({ layers: normalizeLayers(layers) }),

  toggleLayer: (id) =>
    set((state) => ({
      layers: state.layers.map((layer) => (layer.id === id ? { ...layer, visible: !layer.visible } : layer)),
    })),

  resetLayers: () => set({ layers: DEFAULT_LAYERS.map((layer) => ({ ...layer })) }),

  getVisibleLayers: () => get().layers.filter((layer) => layer.visible),

  getLayersByCategory: (category) => get().layers.filter((layer) => layer.category === category),
}))
