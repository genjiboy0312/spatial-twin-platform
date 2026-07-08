import { useMemo, useState } from 'react'

import { usePreferences } from '../app/preferences'
import { AnchorPointMarkers } from '../components/AnchorPointMarkers'
import { OsmTileMapPanel, type OsmMapMarker } from '../components/OsmTileMapPanel'
import { useAlignmentStore } from '../stores/alignmentStore'
import type { AnchorPoint } from '../utils/alignmentUtils'
import { PageHeader } from './PageHeader'

type AlignmentMethod = 'osm' | 'pointcloud'
type ViewMode = 'map' | 'split' | 'model'
type PickTarget = 'origin' | 'point1' | 'point2'

const canvasWidth = 760
const canvasHeight = 480
const pickTargets: PickTarget[] = ['origin', 'point1', 'point2']

const copy = {
  en: {
    eyebrow: 'GPS Alignment',
    title: 'Cesium / OSM Alignment',
    description: 'Separate OSM and PointCloud alignment workflows while marking GPS anchors directly on the map panel.',
    method: 'Alignment Method',
    viewMode: 'View Mode',
    floorModel: 'Model Anchor View',
    osmPanel: 'OSM Map Panel',
    workflow: 'Alignment Workflow',
    localPick: 'Local Point Pick',
    gpsPick: 'GPS Point Pick',
    anchors: 'anchors',
    local: 'Local',
    longitude: 'Longitude',
    latitude: 'Latitude',
    clear: 'Clear Anchors',
    compute: 'Compute Alignment',
    apply: 'Apply Alignment',
    reset: 'Reset',
    remove: 'Remove',
    readyCompute: 'Ready to compute alignment.',
    needsGps: 'Place three local anchors and mark every GPS point on the OSM map.',
    noAnchors: 'Click the model canvas to create Origin, Point 1, and Point 2 anchors.',
    mapInstruction: 'Select Origin, Point 1, or Point 2, then click the OSM map to assign GPS coordinates.',
    pointCloudNote: 'PointCloud alignment keeps the same anchor workflow and uses scan/model point pairing before ICP/Kabsch refinement.',
    result: 'Alignment Result',
    rms: 'RMS error',
    complete: 'GPS Alignment Complete',
    methods: { osm: 'OSM Alignment', pointcloud: 'PointCloud Alignment' },
    views: { map: 'OSM Map', split: 'Split', model: 'Model' },
    targets: { origin: 'Origin', point1: 'Point 1', point2: 'Point 2' },
  },
  ko: {
    eyebrow: 'GPS 정합',
    title: 'Cesium / OSM 정합',
    description: 'OSM 정합과 PointCloud 정합 방법을 분리하고, GPS 앵커를 지도 패널 위에 직접 마킹합니다.',
    method: '정합 방법',
    viewMode: '뷰모드',
    floorModel: '모델 앵커 뷰',
    osmPanel: 'OSM Map Panel',
    workflow: '정합 워크플로우',
    localPick: '로컬 포인트 선택',
    gpsPick: 'GPS 포인트 선택',
    anchors: '앵커',
    local: '로컬',
    longitude: '경도',
    latitude: '위도',
    clear: '앵커 초기화',
    compute: '정합 계산',
    apply: '정합 적용',
    reset: '초기화',
    remove: '삭제',
    readyCompute: '정합 계산 준비가 완료되었습니다.',
    needsGps: '로컬 앵커 3개를 배치하고 OSM 지도에서 모든 GPS 포인트를 마킹하세요.',
    noAnchors: '모델 캔버스를 클릭해서 Origin, Point 1, Point 2 앵커를 생성하세요.',
    mapInstruction: 'Origin, Point 1, Point 2 중 하나를 선택한 뒤 OSM 지도에서 위치를 클릭하세요.',
    pointCloudNote: 'PointCloud 정합도 동일한 앵커 흐름을 유지하고, 스캔/모델 포인트 페어링 후 ICP/Kabsch 보정으로 확장됩니다.',
    result: '정합 결과',
    rms: 'RMS 오차',
    complete: 'GPS 정합 완료',
    methods: { osm: 'OSM 정합', pointcloud: 'PointCloud 정합' },
    views: { map: 'OSM 지도', split: '분할', model: '모델' },
    targets: { origin: 'Origin', point1: 'Point 1', point2: 'Point 2' },
  },
} as const

function hasGpsCoords(anchor: AnchorPoint) {
  return anchor.longitude !== 0 || anchor.latitude !== 0
}

function parseCoordinate(value: string) {
  const next = Number(value)
  return Number.isFinite(next) ? next : 0
}

function targetForIndex(index: number): PickTarget {
  return pickTargets[Math.min(index, pickTargets.length - 1)]!
}

export function AlignmentPage() {
  const { language } = usePreferences()
  const labels = copy[language]
  const anchors = useAlignmentStore((state) => state.anchors)
  const result = useAlignmentStore((state) => state.result)
  const isApplied = useAlignmentStore((state) => state.isApplied)
  const activeAnchorId = useAlignmentStore((state) => state.activeAnchorId)
  const startPlacingAnchor = useAlignmentStore((state) => state.startPlacingAnchor)
  const setAnchorCoords = useAlignmentStore((state) => state.setAnchorCoords)
  const removeAnchor = useAlignmentStore((state) => state.removeAnchor)
  const clearAnchors = useAlignmentStore((state) => state.clearAnchors)
  const compute = useAlignmentStore((state) => state.compute)
  const applyAlignment = useAlignmentStore((state) => state.applyAlignment)
  const resetAlignment = useAlignmentStore((state) => state.resetAlignment)
  const [alignmentMethod, setAlignmentMethod] = useState<AlignmentMethod>('osm')
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [pickTarget, setPickTarget] = useState<PickTarget>('origin')

  const anchorByTarget = useMemo(() => ({
    origin: anchors[0] ?? null,
    point1: anchors[1] ?? null,
    point2: anchors[2] ?? null,
  }), [anchors])

  const readyAnchors = anchors.filter(hasGpsCoords)
  const mapCenter = readyAnchors[0] ? [readyAnchors[0].latitude, readyAnchors[0].longitude] as [number, number] : undefined
  const markers: OsmMapMarker[] = readyAnchors.map((anchor, index) => ({
    id: anchor.id,
    label: index === 0 ? 'O' : String(index),
    latitude: anchor.latitude,
    longitude: anchor.longitude,
    tone: index === 0 ? 'origin' : index === 1 ? 'point1' : 'point2',
  }))
  const canCompute = anchors.length >= 2 && anchors.every(hasGpsCoords)

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const localX = Math.round((event.clientX - rect.left - canvasWidth / 2) * 10) / 10
    const localY = Math.round((event.clientY - rect.top - canvasHeight / 2) * 10) / 10
    startPlacingAnchor(localX, localY)
    setPickTarget(targetForIndex(anchors.length))
  }

  const handleMapPick = (latitude: number, longitude: number) => {
    const anchor = anchorByTarget[pickTarget]
    if (!anchor) return
    setAnchorCoords(anchor.id, longitude, latitude)
  }

  const handleReset = () => {
    resetAlignment()
    clearAnchors()
    setPickTarget('origin')
  }

  const showModel = viewMode === 'split' || viewMode === 'model'
  const showMap = viewMode === 'split' || viewMode === 'map'

  return (
    <section className="page-grid alignment-map-page">
      <PageHeader eyebrow={labels.eyebrow} title={labels.title} description={labels.description} />

      <div className="alignment-map-toolbar">
        <div>
          <span className="eyebrow-muted">{labels.method}</span>
          <div className="alignment-segmented">
            {(['osm', 'pointcloud'] as AlignmentMethod[]).map((method) => (
              <button key={method} className={alignmentMethod === method ? 'active' : ''} type="button" onClick={() => setAlignmentMethod(method)}>
                {labels.methods[method]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="eyebrow-muted">{labels.viewMode}</span>
          <div className="alignment-segmented">
            {(['map', 'split', 'model'] as ViewMode[]).map((mode) => (
              <button key={mode} className={viewMode === mode ? 'active' : ''} type="button" onClick={() => setViewMode(mode)}>
                {labels.views[mode]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`alignment-osm-layout view-${viewMode}`}>
        <main className="alignment-map-workspace">
          {showModel && (
            <section className="alignment-map-panel">
              <div className="alignment-map-panel-header">
                <div>
                  <span className="eyebrow-muted">{labels.floorModel}</span>
                  <h3>{anchors.length} {labels.anchors}</h3>
                </div>
              </div>
              <div className="alignment-canvas enhanced" onClick={handleCanvasClick}>
                <span className="alignment-axis x" />
                <span className="alignment-axis y" />
                <em>(0, 0)</em>
                <AnchorPointMarkers anchors={anchors} activeAnchorId={activeAnchorId} width={canvasWidth} height={canvasHeight} mode="place" />
              </div>
            </section>
          )}

          {showMap && (
            <section className="alignment-map-panel">
              <div className="alignment-map-panel-header">
                <div>
                  <span className="eyebrow-muted">{labels.osmPanel}</span>
                  <h3>{labels.targets[pickTarget]}</h3>
                </div>
              </div>
              <OsmTileMapPanel
                {...(mapCenter ? { center: mapCenter } : {})}
                zoom={16}
                markers={markers}
                onPick={handleMapPick}
                pickLabel={`${labels.gpsPick}: ${labels.targets[pickTarget]}`}
                instruction={alignmentMethod === 'osm' ? labels.mapInstruction : labels.pointCloudNote}
              />
            </section>
          )}
        </main>

        <aside className="alignment-map-side">
          <section className="alignment-map-panel">
            <div className="alignment-map-panel-header">
              <div>
                <span className="eyebrow-muted">{labels.workflow}</span>
                <h3>{labels.methods[alignmentMethod]}</h3>
              </div>
            </div>

            <div className="alignment-pick-targets">
              {pickTargets.map((target) => {
                const anchor = anchorByTarget[target]
                const ready = anchor ? hasGpsCoords(anchor) : false
                return (
                  <button key={target} className={(pickTarget === target ? 'active ' : '') + (ready ? 'ready' : '')} type="button" onClick={() => setPickTarget(target)}>
                    <strong>{labels.targets[target]}</strong>
                    <span>{anchor ? `${anchor.localX.toFixed(1)}, ${anchor.localY.toFixed(1)}` : labels.localPick}</span>
                  </button>
                )
              })}
            </div>

            <div className="alignment-panel-stack">
              <p className={canCompute ? 'alignment-ready' : 'alignment-warning'}>{canCompute ? labels.readyCompute : labels.needsGps}</p>
              {anchors.length === 0 && <p className="spatial-muted-text">{labels.noAnchors}</p>}
              {anchors.map((anchor, index) => (
                <article key={anchor.id} className="alignment-coordinate-card">
                  <strong>{index === 0 ? labels.targets.origin : index === 1 ? labels.targets.point1 : labels.targets.point2}</strong>
                  <small>{labels.local} ({anchor.localX.toFixed(1)}, {anchor.localY.toFixed(1)})</small>
                  <label>
                    {labels.latitude}
                    <input className="text-input" type="number" value={anchor.latitude === 0 ? '' : anchor.latitude} onChange={(event) => setAnchorCoords(anchor.id, anchor.longitude, parseCoordinate(event.target.value))} />
                  </label>
                  <label>
                    {labels.longitude}
                    <input className="text-input" type="number" value={anchor.longitude === 0 ? '' : anchor.longitude} onChange={(event) => setAnchorCoords(anchor.id, parseCoordinate(event.target.value), anchor.latitude)} />
                  </label>
                  <button className="btn btn-secondary" onClick={() => removeAnchor(anchor.id)} type="button">{labels.remove}</button>
                </article>
              ))}
              <button className="btn btn-secondary" disabled={anchors.length === 0} onClick={clearAnchors} type="button">{labels.clear}</button>
              <button className="btn btn-primary" disabled={!canCompute} onClick={compute} type="button">{labels.compute}</button>
            </div>
          </section>

          <section className="alignment-map-panel">
            <div className="alignment-map-panel-header">
              <div>
                <span className="eyebrow-muted">{labels.result}</span>
                <h3>{isApplied ? labels.complete : labels.rms}</h3>
              </div>
            </div>
            {result ? (
              <div className="alignment-result-card">
                <strong>{result.rmsErrorMeters.toFixed(3)} m</strong>
                <span>{result.anchorCount} {labels.anchors}</span>
                {result.residuals.map((residual, index) => (
                  <p key={index}>P{index + 1}: {residual.residualMeters.toFixed(3)} m</p>
                ))}
                <button className="btn btn-primary" onClick={applyAlignment} type="button">{labels.apply}</button>
              </div>
            ) : (
              <button className="btn btn-secondary" onClick={handleReset} type="button">{labels.reset}</button>
            )}
          </section>
        </aside>
      </div>
    </section>
  )
}
