import { useAlignmentStore } from '../stores/alignmentStore'
import type { AnchorPoint } from '../utils/alignmentUtils'

function formatLocal(anchor: AnchorPoint) {
  return `(${anchor.localX.toFixed(2)}, ${anchor.localY.toFixed(2)})`
}

function formatGps(anchor: AnchorPoint) {
  return `${anchor.latitude.toFixed(6)}, ${anchor.longitude.toFixed(6)}`
}

export function AnchorPointWorkflow() {
  const step = useAlignmentStore((s) => s.step)
  const anchors = useAlignmentStore((s) => s.anchors)
  const result = useAlignmentStore((s) => s.result)
  const openMap = useAlignmentStore((s) => s.openMap)
  const removeAnchor = useAlignmentStore((s) => s.removeAnchor)
  const clearAnchors = useAlignmentStore((s) => s.clearAnchors)
  const compute = useAlignmentStore((s) => s.compute)
  const applyAlignment = useAlignmentStore((s) => s.applyAlignment)
  const resetAlignment = useAlignmentStore((s) => s.resetAlignment)

  return (
    <div className="anchor-workflow-panel">
      {(step === 'place' || step === 'coords') && (
        <div className="anchor-step-content">
          <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, marginTop: 0 }}>
            Click on the floor plan to place anchor points (minimum 2, recommended 3+)
          </p>

          <div className="anchor-list" style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            {anchors.map((anchor) => (
              <div
                className="anchor-card"
                key={anchor.id}
                style={{
                  background: '#0f172a',
                  border: '1px solid rgba(148,163,184,0.15)',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <strong style={{ color: '#eef2ff', display: 'block', fontSize: 14 }}>{anchor.label}</strong>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>Local: {formatLocal(anchor)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => openMap(anchor.id)}>
                      Edit
                    </button>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => removeAnchor(anchor.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" type="button" onClick={clearAnchors} disabled={anchors.length === 0}>
              Clear All
            </button>
            <button className="btn btn-primary" type="button" onClick={compute} disabled={anchors.length < 2}>
              Compute Alignment
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="anchor-step-content">
          <div
            style={{
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(96,165,250,0.35)',
              borderRadius: 10,
              marginBottom: 12,
              padding: 14,
            }}
          >
            <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>RMS Error</div>
            <strong style={{ color: '#eef2ff', display: 'block', fontSize: 26 }}>
              {result ? `${result.rmsErrorMeters.toFixed(3)} m` : 'Not computed'}
            </strong>
          </div>

          <div style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 10 }}>
            Anchors: <strong>{anchors.length}</strong>
          </div>

          <div className="anchor-list" style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            {anchors.map((anchor, index) => {
              const residual = result?.residuals[index]

              return (
                <div
                  className="anchor-card"
                  key={anchor.id}
                  style={{
                    background: '#0f172a',
                    border: '1px solid rgba(148,163,184,0.15)',
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <strong style={{ color: '#eef2ff', display: 'block', fontSize: 14, marginBottom: 6 }}>
                    {anchor.label}
                  </strong>
                  <div style={{ color: '#94a3b8', display: 'grid', gap: 3, fontSize: 12 }}>
                    <span>Local: {formatLocal(anchor)}</span>
                    <span>GPS: {formatGps(anchor)}</span>
                    {residual && <span>Residual: {residual.residualMeters.toFixed(3)} m</span>}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" type="button" onClick={applyAlignment} disabled={!result}>
              Apply Alignment
            </button>
            <button className="btn btn-secondary" type="button" onClick={resetAlignment}>
              Back
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="anchor-step-content" style={{ textAlign: 'center' }}>
          <strong style={{ color: '#eef2ff', display: 'block', fontSize: 18, marginBottom: 8 }}>
            ✅ Alignment Applied
          </strong>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
            Final RMS Error: {result ? `${result.rmsErrorMeters.toFixed(3)} m` : 'Not computed'}
          </div>
          <button className="btn btn-secondary" type="button" onClick={resetAlignment}>
            Reset
          </button>
        </div>
      )}
    </div>
  )
}
