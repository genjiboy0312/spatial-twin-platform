import { Link } from 'react-router'

import { usePreferences } from '../app/preferences'
import { OsmTileMapPanel, type OsmMapMarker } from '../components/OsmTileMapPanel'
import { useAlignmentStore } from '../stores/alignmentStore'
import { PageHeader } from './PageHeader'

const copy = {
  en: {
    eyebrow: 'Anchor / Map',
    title: 'OSM Anchor Map',
    description: 'Inspect local-to-GPS anchor points on an OSM map panel and review alignment readiness.',
    summary: 'Alignment Summary',
    mapPanel: 'OSM Map Panel',
    mapInstruction: 'Click the map from Alignment to place GPS markers. Drag to pan, wheel to zoom.',
    noAnchors: 'No anchors yet',
    emptyBody: 'Use the Alignment page to place local points and assign GPS coordinates.',
    openAlignment: 'Open GPS Alignment',
    label: 'Label',
    local: 'Local',
    gps: 'GPS',
    id: 'ID',
    ready: 'Map-ready anchors',
    notSet: 'GPS not set',
  },
  ko: {
    eyebrow: 'Anchor / Map',
    title: 'OSM 앵커 지도',
    description: '로컬-GPS 앵커 포인트를 OSM 지도 패널 위에서 확인하고 정합 준비 상태를 검토합니다.',
    summary: '정합 요약',
    mapPanel: 'OSM Map Panel',
    mapInstruction: 'Alignment 페이지에서 지도 클릭으로 GPS 마커를 배치하세요. 드래그로 이동, 휠로 확대/축소합니다.',
    noAnchors: '아직 앵커 없음',
    emptyBody: 'GPS 정합 페이지에서 로컬 지점을 찍고 GPS 좌표를 지정하세요.',
    openAlignment: 'GPS 정합 열기',
    label: '라벨',
    local: '로컬',
    gps: 'GPS',
    id: 'ID',
    ready: '지도 준비 앵커',
    notSet: 'GPS 미설정',
  },
} as const

function hasGps(longitude: number, latitude: number) {
  return longitude !== 0 || latitude !== 0
}

export function AnchorsPage() {
  const { language } = usePreferences()
  const labels = copy[language]
  const anchors = useAlignmentStore((state) => state.anchors)
  const summary = useAlignmentStore((state) => state.getSummary())
  const readyAnchors = anchors.filter((anchor) => hasGps(anchor.longitude, anchor.latitude))
  const center = readyAnchors[0] ? [readyAnchors[0].latitude, readyAnchors[0].longitude] as [number, number] : undefined
  const markers: OsmMapMarker[] = readyAnchors.map((anchor, index) => ({
    id: anchor.id,
    label: String(index + 1),
    latitude: anchor.latitude,
    longitude: anchor.longitude,
    tone: index === 0 ? 'origin' : index === 1 ? 'point1' : index === 2 ? 'point2' : 'picked',
  }))

  return (
    <section className="page-grid anchors-map-page">
      <PageHeader eyebrow={labels.eyebrow} title={labels.title} description={labels.description} />

      <div className="anchors-map-layout">
        <main className="anchors-panel">
          <div className="spatial-card-topline" />
          <div className="anchors-panel-header">
            <div>
              <span className="eyebrow-muted">{labels.summary}</span>
              <h3>{readyAnchors.length}/{anchors.length}</h3>
            </div>
            <Link className="btn btn-secondary" to="/alignment">{labels.openAlignment}</Link>
          </div>

          {anchors.length === 0 ? (
            <div className="spatial-empty-state inset">
              <strong>{labels.noAnchors}</strong>
              <p>{labels.emptyBody}</p>
            </div>
          ) : (
            <div className="anchors-table">
              <div className="anchors-table-row head">
                <span>{labels.label}</span>
                <span>{labels.local}</span>
                <span>{labels.gps}</span>
                <span>{labels.id}</span>
              </div>
              {anchors.map((anchor) => (
                <div key={anchor.id} className="anchors-table-row">
                  <span>{anchor.label}</span>
                  <span>{anchor.localX.toFixed(2)}, {anchor.localY.toFixed(2)}</span>
                  <span>{hasGps(anchor.longitude, anchor.latitude) ? `${anchor.latitude.toFixed(6)}, ${anchor.longitude.toFixed(6)}` : labels.notSet}</span>
                  <span>{anchor.id}</span>
                </div>
              ))}
            </div>
          )}
        </main>

        <aside className="anchors-panel">
          <div className="spatial-card-topline muted" />
          <div className="anchors-panel-header">
            <div>
              <span className="eyebrow-muted">{labels.mapPanel}</span>
              <h3>{labels.ready}</h3>
            </div>
          </div>
          <OsmTileMapPanel
            {...(center ? { center } : {})}
            zoom={16}
            markers={markers}
            readOnly
            pickLabel={labels.mapPanel}
            instruction={labels.mapInstruction}
          />
          <pre className="summary-pre spatial-summary-pre">{summary}</pre>
        </aside>
      </div>
    </section>
  )
}
