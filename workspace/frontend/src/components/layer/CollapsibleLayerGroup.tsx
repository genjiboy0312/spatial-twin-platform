import { useState, type ReactNode } from 'react'
import type { LayerCategoryInfo } from '../../stores/layerStore'

interface Props {
  category: LayerCategoryInfo
  children: ReactNode
  defaultOpen?: boolean
  count?: number
}

export function CollapsibleLayerGroup({ category, children, defaultOpen = true, count }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="collapsible-layer-group">
      <button
        className="collapsible-layer-header"
        type="button"
        onClick={() => setOpen(!open)}
      >
        <span className="collapsible-layer-arrow" data-open={open}>
          ▶
        </span>
        <span className="collapsible-layer-icon">{category.icon}</span>
        <span className="collapsible-layer-label">{category.label}</span>
        {count !== undefined && (
          <span className="collapsible-layer-count">{count}</span>
        )}
      </button>
      {open && <div className="collapsible-layer-body">{children}</div>}
    </div>
  )
}
