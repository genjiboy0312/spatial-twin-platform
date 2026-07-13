import type { LayerConfig } from '../../stores/layerStore'

interface Props {
  layer: LayerConfig
  language: 'en' | 'ko'
  onVisibilityChange: (layer: LayerConfig, visible: boolean) => void
  onOpacityChange: (layer: LayerConfig, opacity: number) => void
}

export function LayerItemWithSlider({ layer, language, onVisibilityChange, onOpacityChange }: Props) {
  return (
    <div className={`layer-item ${layer.visible ? '' : 'muted'}`}>
      <label className="layer-item-label">
        <input
          type="checkbox"
          checked={layer.visible}
          onChange={(event) => onVisibilityChange(layer, event.target.checked)}
        />
        {layer.color && (
          <span
            className="layer-color-dot"
            style={{ background: layer.color, opacity: layer.visible ? layer.opacity : 0.3 }}
          />
        )}
        <span className="layer-name">{language === 'ko' ? layer.label : layer.labelEn}</span>
      </label>
      <div className="layer-slider-row">
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={layer.opacity}
          onChange={(event) => onOpacityChange(layer, Number(event.target.value))}
          className="layer-opacity-slider"
          disabled={!layer.visible}
        />
        <span className="layer-opacity-value">{Math.round(layer.opacity * 100)}%</span>
      </div>
    </div>
  )
}
