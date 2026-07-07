import React, { Suspense, useMemo } from 'react'
import { PageHeader } from './PageHeader'
import { AnchorPointMarkers } from '../components/AnchorPointMarkers'
import { useAlignmentStore, type AlignmentStep } from '../stores/alignmentStore'
import type { AnchorPoint } from '../utils/alignmentUtils'

const OsmMapPicker = React.lazy(() =>
  import('../components/OsmMapPicker').then((m) => ({ default: m.OsmMapPicker })),
)

const CANVAS_W = 760
const CANVAS_H = 480
const STEP_KEYS: AlignmentStep[] = ['place', 'coords', 'review', 'done']
const WORKFLOW_STEPS: { key: AlignmentStep; label: string; description: string }[] = [
  { key: 'place', label: 'Place Anchors', description: 'Mark known points on the plan' },
  { key: 'coords', label: 'Set Coordinates', description: 'Enter or pick GPS values' },
  { key: 'review', label: 'Review', description: 'Check residual error' },
  { key: 'done', label: 'Done', description: 'Apply the alignment' },
]

function hasGpsCoords(anchor: AnchorPoint) {
  return anchor.longitude !== 0 || anchor.latitude !== 0
}

function parseCoordinate(value: string) {
  const next = Number(value)
  return Number.isFinite(next) ? next : 0
}

function formatGps(anchor: AnchorPoint) {
  if (!hasGpsCoords(anchor)) return 'GPS not set'
  return `${anchor.longitude.toFixed(6)}, ${anchor.latitude.toFixed(6)}`
}

export function AlignmentPage() {
  const step = useAlignmentStore((s) => s.step)
  const anchors = useAlignmentStore((s) => s.anchors)
  const params = useAlignmentStore((s) => s.params)
  const result = useAlignmentStore((s) => s.result)
  const isApplied = useAlignmentStore((s) => s.isApplied)
  const mapOpen = useAlignmentStore((s) => s.mapOpen)
  const activeAnchorId = useAlignmentStore((s) => s.activeAnchorId)
  const setStep = useAlignmentStore((s) => s.setStep)
  const startPlacingAnchor = useAlignmentStore((s) => s.startPlacingAnchor)
  const setAnchorCoords = useAlignmentStore((s) => s.setAnchorCoords)
  const removeAnchor = useAlignmentStore((s) => s.removeAnchor)
  const clearAnchors = useAlignmentStore((s) => s.clearAnchors)
  const compute = useAlignmentStore((s) => s.compute)
  const applyAlignment = useAlignmentStore((s) => s.applyAlignment)
  const resetAlignment = useAlignmentStore((s) => s.resetAlignment)
  const openMap = useAlignmentStore((s) => s.openMap)
  const closeMap = useAlignmentStore((s) => s.closeMap)

  const activeAnchor = useMemo(
    () => anchors.find((anchor) => anchor.id === activeAnchorId),
    [activeAnchorId, anchors],
  )
  const currentStepIndex = STEP_KEYS.indexOf(step)
  const canCompute = anchors.length >= 2 && anchors.every(hasGpsCoords)

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (step !== 'place') return

    const rect = event.currentTarget.getBoundingClientRect()
    const localX = Math.round((event.clientX - rect.left - CANVAS_W / 2) * 10) / 10
    const localY = Math.round((event.clientY - rect.top - CANVAS_H / 2) * 10) / 10
    startPlacingAnchor(localX, localY)
  }

  const handleMapSelect = (longitude: number, latitude: number) => {
    if (!activeAnchorId) return
    setAnchorCoords(activeAnchorId, longitude, latitude)
  }

  const handleReset = () => {
    resetAlignment()
    clearAnchors()
  }

  return (
    <section className="page-grid editor-layout" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <PageHeader
        eyebrow="Phase 6"
        title="GPS Alignment"
        description="Align floor plan coordinates with real-world GPS coordinates using anchor points"
      />

      <div
        className="full-width"
        style={{
          display: 'grid',
          gridTemplateColumns: '220px minmax(0, 1fr)',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <aside
          style={{
            background: '#0b1220',
            border: '1px solid rgba(148, 163, 184, 0.18)',
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div
            style={{
              color: '#38bdf8',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.12em',
              marginBottom: 14,
              textTransform: 'uppercase',
            }}
          >
            Workflow Steps
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {WORKFLOW_STEPS.map((workflowStep, index) => {
              const isActive = workflowStep.key === step
              const isComplete = index < currentStepIndex || (workflowStep.key === 'done' && isApplied)
              const canNavigate = index <= currentStepIndex || (workflowStep.key === 'coords' && anchors.length > 0)

              return (
                <button
                  key={workflowStep.key}
                  type="button"
                  disabled={!canNavigate}
                  onClick={() => setStep(workflowStep.key)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '30px 1fr',
                    gap: 10,
                    alignItems: 'start',
                    padding: '10px 8px',
                    border: '1px solid rgba(148, 163, 184, 0.12)',
                    borderRadius: 12,
                    background: isActive ? 'rgba(59, 130, 246, 0.18)' : 'rgba(15, 23, 42, 0.58)',
                    color: '#e2e8f0',
                    cursor: canNavigate ? 'pointer' : 'not-allowed',
                    opacity: canNavigate ? 1 : 0.48,
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      background: isComplete ? '#22c55e' : isActive ? '#3b82f6' : '#1e293b',
                      color: '#fff',
                      display: 'inline-grid',
                      fontSize: 12,
                      fontWeight: 800,
                      placeItems: 'center',
                    }}
                  >
                    {isComplete ? '✓' : index + 1}
                  </span>
                  <span>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{workflowStep.label}</span>
                    <span style={{ color: '#94a3b8', display: 'block', fontSize: 11, lineHeight: 1.4 }}>
                      {workflowStep.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="viewer-container" style={{ minWidth: CANVAS_W }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ color: '#eef2ff', fontSize: 14, fontWeight: 700 }}>2D Canvas Viewport</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>
                Origin is centered at (0, 0); x increases right, y increases down.
              </div>
            </div>
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right' }}>
              {anchors.length} anchor{anchors.length === 1 ? '' : 's'} placed
            </div>
          </div>

          <div
            onClick={handleCanvasClick}
            style={{
              backgroundColor: '#0b1220',
              backgroundImage:
                'linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(rgba(148, 163, 184, 0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.14) 1px, transparent 1px)',
              backgroundPosition: '0 0, 0 0, 0 0, 0 0',
              backgroundSize: '20px 20px, 20px 20px, 100px 100px, 100px 100px',
              border: '1px solid rgba(148, 163, 184, 0.18)',
              borderRadius: 16,
              boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.5)',
              cursor: step === 'place' ? 'crosshair' : 'default',
              height: CANVAS_H,
              overflow: 'hidden',
              position: 'relative',
              width: CANVAS_W,
            }}
          >
            <div
              aria-hidden="true"
              style={{
                background: 'rgba(56, 189, 248, 0.6)',
                height: 1,
                left: CANVAS_W / 2 - 18,
                position: 'absolute',
                top: CANVAS_H / 2,
                width: 36,
              }}
            />
            <div
              aria-hidden="true"
              style={{
                background: 'rgba(56, 189, 248, 0.6)',
                height: 36,
                left: CANVAS_W / 2,
                position: 'absolute',
                top: CANVAS_H / 2 - 18,
                width: 1,
              }}
            />
            <div
              style={{
                color: '#64748b',
                fontSize: 11,
                left: CANVAS_W / 2 + 8,
                position: 'absolute',
                top: CANVAS_H / 2 - 18,
              }}
            >
              (0, 0)
            </div>
            {step !== 'place' && anchors.length === 0 && (
              <div
                style={{
                  color: '#64748b',
                  fontSize: 14,
                  left: '50%',
                  position: 'absolute',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                No anchor points placed
              </div>
            )}
            <AnchorPointMarkers
              anchors={anchors}
              activeAnchorId={activeAnchorId}
              width={CANVAS_W}
              height={CANVAS_H}
              mode={step === 'place' ? 'place' : 'view'}
            />
          </div>
        </div>
      </div>

      <div
        className="full-width"
        style={{
          background: '#0b1220',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: 16,
          padding: 18,
        }}
      >
        {step === 'place' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>1. Place anchor points</h2>
                <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  Click the canvas to place local anchor points. Add at least one anchor to continue, and two or more
                  anchor points before computing alignment.
                </p>
              </div>
              <button className="btn btn-secondary" disabled={anchors.length === 0} onClick={clearAnchors} type="button">
                Clear Anchors
              </button>
            </div>

            {anchors.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: 13, padding: '12px 0' }}>
                No anchors yet. Use the crosshair cursor in the viewport above to place the first point.
              </div>
            ) : (
              <AnchorList anchors={anchors} onRemove={removeAnchor} />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                className="btn btn-primary"
                disabled={anchors.length === 0}
                onClick={() => setStep('coords')}
                type="button"
              >
                Continue to Coordinates
              </button>
            </div>
          </div>
        )}

        {step === 'coords' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>2. Set GPS coordinates</h2>
                <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  Enter longitude and latitude for each anchor, or use Pick from Map to select coordinates visually.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => setStep('place')} type="button">
                Back to Anchors
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {anchors.map((anchor) => (
                <div
                  key={anchor.id}
                  style={{
                    background: '#0f172a',
                    border: `1px solid ${hasGpsCoords(anchor) ? 'rgba(34, 197, 94, 0.32)' : 'rgba(248, 113, 113, 0.32)'}`,
                    borderRadius: 12,
                    display: 'grid',
                    gap: 10,
                    gridTemplateColumns: '1.1fr 1fr 1fr auto auto',
                    padding: 12,
                    alignItems: 'end',
                  }}
                >
                  <div>
                    <div style={{ color: '#eef2ff', fontSize: 14, fontWeight: 700 }}>{anchor.label}</div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>
                      Local ({anchor.localX.toFixed(1)}, {anchor.localY.toFixed(1)})
                    </div>
                  </div>
                  <label style={{ color: '#94a3b8', display: 'grid', fontSize: 12, gap: 5 }}>
                    Longitude
                    <input
                      className="select-input"
                      inputMode="decimal"
                      step="0.000001"
                      type="number"
                      value={anchor.longitude === 0 ? '' : anchor.longitude}
                      onChange={(event) => setAnchorCoords(anchor.id, parseCoordinate(event.target.value), anchor.latitude)}
                      placeholder="126.978400"
                    />
                  </label>
                  <label style={{ color: '#94a3b8', display: 'grid', fontSize: 12, gap: 5 }}>
                    Latitude
                    <input
                      className="select-input"
                      inputMode="decimal"
                      step="0.000001"
                      type="number"
                      value={anchor.latitude === 0 ? '' : anchor.latitude}
                      onChange={(event) => setAnchorCoords(anchor.id, anchor.longitude, parseCoordinate(event.target.value))}
                      placeholder="37.566500"
                    />
                  </label>
                  <button className="btn btn-secondary" onClick={() => openMap(anchor.id)} type="button">
                    Pick from Map
                  </button>
                  <button className="btn btn-secondary" onClick={() => removeAnchor(anchor.id)} type="button">
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
              <span style={{ color: canCompute ? '#4ade80' : '#fbbf24', fontSize: 12 }}>
                {canCompute
                  ? 'Ready to compute alignment.'
                  : 'Add GPS coordinates to every placed anchor before computing.'}
              </span>
              <button className="btn btn-primary" disabled={!canCompute} onClick={compute} type="button">
                Compute Alignment
              </button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>3. Review alignment quality</h2>
                <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  Check RMS error and per-anchor residuals before applying the GPS alignment.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => setStep('coords')} type="button">
                Edit Coordinates
              </button>
            </div>

            {result ? (
              <>
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.78)',
                    border: '1px solid rgba(148, 163, 184, 0.14)',
                    borderRadius: 14,
                    marginBottom: 12,
                    padding: 16,
                  }}
                >
                  <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>RMS error</div>
                  <div
                    style={{
                      color: result.rmsErrorMeters <= 1 ? '#4ade80' : result.rmsErrorMeters <= 5 ? '#fbbf24' : '#f87171',
                      fontSize: 32,
                      fontWeight: 800,
                    }}
                  >
                    {result.rmsErrorMeters.toFixed(3)} m
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    Computed from {result.anchorCount} anchor point{result.anchorCount === 1 ? '' : 's'}.
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
                  {result.residuals.map((residual, index) => {
                    const anchor = anchors[index]
                    return (
                      <div
                        key={anchor?.id ?? index}
                        style={{
                          alignItems: 'center',
                          background: '#0f172a',
                          border: '1px solid rgba(148, 163, 184, 0.12)',
                          borderRadius: 10,
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                        }}
                      >
                        <div>
                          <div style={{ color: '#eef2ff', fontSize: 13, fontWeight: 700 }}>
                            {anchor?.label ?? `Anchor ${index + 1}`}
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: 12 }}>
                            Local ({residual.local.x.toFixed(1)}, {residual.local.y.toFixed(1)})
                          </div>
                        </div>
                        <div
                          style={{
                            color: residual.residualMeters <= 1 ? '#4ade80' : residual.residualMeters <= 5 ? '#fbbf24' : '#f87171',
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {residual.residualMeters.toFixed(3)} m
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" disabled={!params} onClick={applyAlignment} type="button">
                    Apply Alignment
                  </button>
                </div>
              </>
            ) : (
              <div style={{ color: '#fbbf24', fontSize: 13 }}>
                Alignment has not been computed yet. Return to coordinates and compute alignment.
              </div>
            )}
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 38, marginBottom: 8 }}>✅</div>
            <h2 style={{ fontSize: 22, margin: '0 0 8px' }}>GPS Alignment Complete</h2>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 16px' }}>
              Final RMS error: {result ? `${result.rmsErrorMeters.toFixed(3)} m` : 'not available'}
            </p>
            <button className="btn btn-secondary" onClick={handleReset} type="button">
              Reset
            </button>
          </div>
        )}
      </div>

      {mapOpen && activeAnchorId && (
        <Suspense
          fallback={
            <div
              style={{
                alignItems: 'center',
                background: 'rgba(0, 0, 0, 0.6)',
                color: '#94a3b8',
                display: 'flex',
                inset: 0,
                justifyContent: 'center',
                position: 'fixed',
                zIndex: 9999,
              }}
            >
              Loading map...
            </div>
          }
        >
          <OsmMapPicker
            open={mapOpen}
            onSelect={handleMapSelect}
            onClose={closeMap}
            initialLatitude={activeAnchor && activeAnchor.latitude !== 0 ? activeAnchor.latitude : 37.5665}
            initialLongitude={activeAnchor && activeAnchor.longitude !== 0 ? activeAnchor.longitude : 126.9784}
          />
        </Suspense>
      )}
    </section>
  )
}

function AnchorList({ anchors, onRemove }: { anchors: AnchorPoint[]; onRemove: (id: string) => void }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {anchors.map((anchor) => (
        <div
          key={anchor.id}
          style={{
            alignItems: 'center',
            background: '#0f172a',
            border: '1px solid rgba(148, 163, 184, 0.12)',
            borderRadius: 10,
            display: 'grid',
            gap: 12,
            gridTemplateColumns: '1fr 1fr auto',
            padding: '10px 12px',
          }}
        >
          <div>
            <div style={{ color: '#eef2ff', fontSize: 13, fontWeight: 700 }}>{anchor.label}</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>
              Local ({anchor.localX.toFixed(1)}, {anchor.localY.toFixed(1)})
            </div>
          </div>
          <div style={{ color: hasGpsCoords(anchor) ? '#4ade80' : '#64748b', fontSize: 12 }}>
            {formatGps(anchor)}
          </div>
          <button className="btn btn-secondary" onClick={() => onRemove(anchor.id)} type="button">
            Remove
          </button>
        </div>
      ))}
    </div>
  )
}
