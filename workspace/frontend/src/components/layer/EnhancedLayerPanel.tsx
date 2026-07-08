import { LAYER_CATEGORIES, useLayerStore } from '../../stores/layerStore'
import { CollapsibleLayerGroup } from './CollapsibleLayerGroup'
import { LayerItemWithSlider } from './LayerItemWithSlider'

export function EnhancedLayerPanel() {
  const layers = useLayerStore((s) => s.layers)

  return (
    <div className="enhanced-layer-panel">
      <div className="enhanced-layer-panel-header">
        <span className="eyebrow-muted">레이어</span>
      </div>
      <div className="enhanced-layer-list">
        {LAYER_CATEGORIES.map((cat) => {
          const catLayers = layers.filter((layer) => layer.category === cat.id)
          if (catLayers.length === 0) return null
          return (
            <CollapsibleLayerGroup key={cat.id} category={cat} count={catLayers.length}>
              {catLayers.map((layer) => (
                <LayerItemWithSlider key={layer.id} layer={layer} />
              ))}
            </CollapsibleLayerGroup>
          )
        })}
      </div>
    </div>
  )
}
