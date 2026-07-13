import { useEffect } from 'react'
import { usePreferences } from '../../app/preferences'
import { useEditorStore, type EditorVisibleLayers } from '../../stores/editorStore'
import { LAYER_CATEGORIES, useLayerStore, type LayerConfig, type LayerId } from '../../stores/layerStore'
import { CollapsibleLayerGroup } from './CollapsibleLayerGroup'
import { LayerItemWithSlider } from './LayerItemWithSlider'

const editorLayerMap: Partial<Record<LayerId, keyof EditorVisibleLayers>> = {
  walls: 'walls',
  rooms: 'rooms',
  'floor-plan': 'floorPlan',
  grid: 'grid',
  coverage: 'coverage',
  heatmap: 'heatmap',
  pathway: 'pathway',
}

const openingLayerIds: LayerId[] = ['doors', 'windows', 'passages']
const deviceLayerIds: LayerId[] = ['cameras', 'sensors', 'alarms', 'access']

export function EnhancedLayerPanel() {
  const { language } = usePreferences()
  const layers = useLayerStore((state) => state.layers)
  const setLayerVisibility = useLayerStore((state) => state.setLayerVisibility)
  const setLayerOpacity = useLayerStore((state) => state.setLayerOpacity)
  const resetLayers = useLayerStore((state) => state.resetLayers)
  const setVisibleLayer = useEditorStore((state) => state.setVisibleLayer)

  useEffect(() => {
    layers.forEach((layer) => {
      const editorLayer = editorLayerMap[layer.id]
      if (editorLayer) setVisibleLayer(editorLayer, layer.visible)
    })
    setVisibleLayer('openings', layers.some((layer) => openingLayerIds.includes(layer.id) && layer.visible))
    setVisibleLayer('devices', layers.some((layer) => deviceLayerIds.includes(layer.id) && layer.visible))
  }, [layers, setVisibleLayer])

  const handleVisibilityChange = (layer: LayerConfig, visible: boolean) => {
    setLayerVisibility(layer.id, visible)
  }

  const handleOpacityChange = (layer: LayerConfig, opacity: number) => {
    setLayerOpacity(layer.id, opacity)
  }

  return (
    <div className="enhanced-layer-panel">
      <div className="enhanced-layer-panel-header">
        <span className="eyebrow-muted">{language === 'ko' ? '레이어' : 'Layers'}</span>
        <button className="layer-reset-btn" type="button" onClick={resetLayers}>
          {language === 'ko' ? '초기화' : 'Reset'}
        </button>
      </div>
      <div className="enhanced-layer-list">
        {LAYER_CATEGORIES.map((category) => {
          const categoryLayers = layers.filter((layer) => layer.category === category.id)
          if (categoryLayers.length === 0) return null
          return (
            <CollapsibleLayerGroup key={category.id} category={category} count={categoryLayers.length} language={language}>
              {categoryLayers.map((layer) => (
                <LayerItemWithSlider
                  key={layer.id}
                  layer={layer}
                  language={language}
                  onVisibilityChange={handleVisibilityChange}
                  onOpacityChange={handleOpacityChange}
                />
              ))}
            </CollapsibleLayerGroup>
          )
        })}
      </div>
    </div>
  )
}
