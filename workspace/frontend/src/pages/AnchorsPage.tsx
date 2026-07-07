import { PageHeader } from './PageHeader'
import { useAlignmentStore } from '../stores/alignmentStore'

export function AnchorsPage() {
  const anchors = useAlignmentStore((state) => state.anchors)
  const summary = useAlignmentStore((state) => state.getSummary())

  return (
    <section className="page-grid">
      <PageHeader
        eyebrow="Anchors"
        title="Alignment Anchors"
        description="Inspect local-to-GPS anchor points created during alignment."
      />

      <div className="card">
        <strong>Alignment Summary</strong>
        <pre className="summary-pre">{summary}</pre>
      </div>

      {anchors.length === 0 ? (
        <div className="card empty-state">
          <strong>No anchors yet</strong>
          <p>Use the Alignment page to place local points and assign GPS coordinates.</p>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-row table-head"><span>Label</span><span>Local</span><span>GPS</span><span>ID</span></div>
          {anchors.map((anchor) => (
            <div key={anchor.id} className="table-row">
              <span>{anchor.label}</span>
              <span>{anchor.localX.toFixed(2)}, {anchor.localY.toFixed(2)}</span>
              <span>{anchor.longitude.toFixed(6)}, {anchor.latitude.toFixed(6)}</span>
              <span>{anchor.id}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
