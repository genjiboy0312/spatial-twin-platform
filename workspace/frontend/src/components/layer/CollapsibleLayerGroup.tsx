import { useState, type ReactNode } from 'react'
import type { LayerCategoryInfo } from '../../stores/layerStore'

interface Props {
  category: LayerCategoryInfo
  children: ReactNode
  defaultOpen?: boolean
  count?: number
  language: 'en' | 'ko'
}

export function CollapsibleLayerGroup({ category, children, defaultOpen = true, count, language }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="collapsible-layer-group">
      <button
        className="collapsible-layer-header"
        type="button"
        onClick={() => setOpen(!open)}
      >
        <span className="collapsible-layer-arrow" data-open={open}>
          &rsaquo;
        </span>
        <span className="collapsible-layer-icon">{category.icon}</span>
        <span className="collapsible-layer-label">{language === 'ko' ? category.label : category.labelEn}</span>
        {count !== undefined && (
          <span className="collapsible-layer-count">{count}</span>
        )}
      </button>
      {open && <div className="collapsible-layer-body">{children}</div>}
    </div>
  )
}
