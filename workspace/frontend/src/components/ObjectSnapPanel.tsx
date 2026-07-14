import { SnapType, SNAP_TYPE_KOR_LABELS, type SnapConfig } from '../utils/objectSnap'

interface Props {
  snapConfig: SnapConfig
  language: 'ko' | 'en'
  onToggleEnabled: () => void
  onToggleType: (type: SnapType) => void
  onChangeRadius: (radius: number) => void
}

const SNAP_TYPES = Object.values(SnapType)

export function ObjectSnapPanel({ snapConfig, language, onToggleEnabled, onToggleType, onChangeRadius }: Props) {
  const isKorean = language === 'ko'
  return (
    <section className={`object-snap-panel${snapConfig.enabled ? ' snap-active' : ''}`}>
      <div className="object-snap-header">
        <h3 className="eyebrow-muted">{isKorean ? '오브젝트 스냅' : 'Object Snap'}</h3>
        <button
          type="button"
          className={`snap-toggle-btn ${snapConfig.enabled ? 'on' : 'off'}`}
          onClick={onToggleEnabled}
        >
          {snapConfig.enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {snapConfig.enabled && (
        <div className="object-snap-body">
          {/* Snap radius */}
          <div className="snap-radius-row">
            <span className="snap-label">{isKorean ? '반경' : 'Radius'}</span>
            <input
              type="range"
              min="5"
              max="25"
              step="1"
              value={snapConfig.tolerance}
              onChange={(e) => onChangeRadius(parseInt(e.target.value, 10))}
              className="snap-radius-slider"
            />
            <span className="snap-radius-value">{snapConfig.tolerance}px</span>
          </div>

          {/* Snap type grid */}
          <div className="snap-type-grid">
            {SNAP_TYPES.map((type) => {
              const isActive = snapConfig.types.includes(type)
              const is2DOnly = type === SnapType.INTERSECTION || type === SnapType.GRID
              return (
                <button
                  key={type}
                  type="button"
                  className={`snap-type-btn ${isActive ? 'active' : ''}`}
                  onClick={() => onToggleType(type)}
                  title={SNAP_TYPE_KOR_LABELS[type]}
                >
                  <span>{SNAP_TYPE_KOR_LABELS[type]}</span>
                  {is2DOnly && <small className="snap-type-badge">2D</small>}
                </button>
              )
            })}
          </div>

          <div className="snap-footer">
            <span className="snap-hint">{isKorean ? '도면 배치 위치 자동 정렬' : 'Automatically align placements'}</span>
            <span className={`snap-count ${snapConfig.types.length > 0 ? 'has' : ''}`}>
              {isKorean ? `${snapConfig.types.length}개 활성` : `${snapConfig.types.length} active`}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
