import { useLayerStore, type LayerConfig } from '../../stores/layerStore'

interface Props {
  layer: LayerConfig
}

export function LayerItemWithSlider({ layer }: Props) {
  const setLayerVisibility = useLayerStore((s) => s.setLayerVisibility)
  const setLayerOpacity = useLayerStore((s) => s.setLayerOpacity)

  return (
    <div className="layer-item">
      <label className="layer-item-label">
        <input
          type="checkbox"
          checked={layer.visible}
          onChange={(e) => setLayerVisibility(layer.id, e.target.checked)}
        />
        {layer.color && (
          <span
            className="layer-color-dot"
            style={{ background: layer.color, opacity: layer.visible ? layer.opacity : 0.3 }}
          />
        )}
        <span className="layer-name">{layer.label}</span>
      </label>
      <div className="layer-slider-row">
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={layer.opacity}
          onChange={(e) => setLayerOpacity(layer.id, Number(e.target.value))}
          className="layer-opacity-slider"
        />
        <span className="layer-opacity-value">{Math.round(layer.opacity * 100)}%</span>
      </div>
    </div>
  )
}
