import { useMemo } from 'react'

import { Alignment3DViewer } from './Alignment3DViewer'
import type { Room2D, Wall2D } from '../../../components/Canvas2DViewer'
import type { SecurityDevice } from '../../../stores/editorStore'

type AlignmentMethod = 'osm' | 'pointcloud'
type PickMode = 'none' | 'origin' | 'point1' | 'point2' | 'display'
type AnchorTuple = [number, number, number]
type Language = 'ko' | 'en'

type Floor = {
  id: number
  floor_number: number
  floor_name: string | null
}

type PickAnchorMarker = {
  point: AnchorTuple
  label: string
  kind: 'model' | 'cloud' | 'gps-origin'
}

type AlignmentMapMarker = {
  id: string
  label: string
  latitude: number
  longitude: number
  tone?: 'origin' | 'point1' | 'point2' | 'picked'
}

const labels = {
  ko: {
    title: '3D View',
    subtitle: 'OSM 지도 위에 모델과 정합 기준점을 표시합니다.',
    method: '정합 방법',
    view: '보기',
    mapTitle: 'OSM 3D 지도',
    mapInstruction: '3D 지도 바닥을 클릭해 현재 픽 모드의 GPS 좌표를 선택합니다.',
    noFloor: '선택된 층이 없습니다.',
    pickMode: '픽 모드',
    markers: '마커',
    noMarkers: '표시할 기준점 마커가 없습니다.',
  },
  en: {
    title: '3D View',
    subtitle: 'Display model and alignment control points over the OSM map.',
    method: 'Alignment method',
    view: 'View',
    mapTitle: 'OSM 3D Map',
    mapInstruction: 'Click the 3D map ground to pick GPS coordinates for the active pick mode.',
    noFloor: 'No floor is selected.',
    pickMode: 'Pick mode',
    markers: 'Markers',
    noMarkers: 'No anchor markers to display.',
  },
} as const

interface AlignmentCenterViewerPanelProps {
  selectedFloor?: Floor | null
  selectedFloorId: number | null
  alignmentMethod: AlignmentMethod
  cameraViewMode: 'top' | 'perspective'
  viewMode?: string
  buildingOrigin: [number, number] | null
  osmQuadZoom?: number
  osmQuadOpacity?: number
  handleSceneAnchorPick: (point: AnchorTuple, source: '2d' | '3d') => void
  pickAnchorMarkers: PickAnchorMarker[]
  handleOsmPick: (gps: [number, number], localPoint: AnchorTuple) => void
  handleOsmHoverPick: (gps: [number, number], localPoint: AnchorTuple) => void
  pickMode: PickMode
  walls: Wall2D[]
  rooms: Room2D[]
  devices: SecurityDevice[]
  language?: Language
}

function gpsToLocalPoint(buildingOrigin: [number, number], latitude: number, longitude: number): AnchorTuple {
  const latitudeScale = Math.cos((buildingOrigin[0] * Math.PI) / 180)
  return [
    (longitude - buildingOrigin[1]) * 111_320 * latitudeScale,
    0,
    (latitude - buildingOrigin[0]) * 111_320,
  ]
}

function localPointToGps(buildingOrigin: [number, number], point: AnchorTuple) {
  const latitudeScale = Math.cos((buildingOrigin[0] * Math.PI) / 180)
  return {
    latitude: buildingOrigin[0] + point[2] / 111_320,
    longitude: buildingOrigin[1] + point[0] / (111_320 * latitudeScale),
  }
}

function markerTone(marker: PickAnchorMarker, index: number): NonNullable<AlignmentMapMarker['tone']> {
  const lower = marker.label.toLowerCase()
  if (marker.kind === 'gps-origin' || lower.includes('origin')) return 'origin'
  if (lower.includes('point1') || lower.includes('p1')) return 'point1'
  if (lower.includes('point2') || lower.includes('p2')) return 'point2'
  return index === 0 ? 'origin' : 'picked'
}

export function AlignmentCenterViewerPanel({
  selectedFloor = null,
  selectedFloorId,
  alignmentMethod,
  cameraViewMode,
  viewMode,
  buildingOrigin,
  osmQuadZoom = 17,
  osmQuadOpacity = 1,
  handleSceneAnchorPick,
  pickAnchorMarkers,
  handleOsmPick,
  handleOsmHoverPick,
  pickMode,
  walls,
  rooms,
  devices,
  language = 'ko',
}: AlignmentCenterViewerPanelProps) {
  const t = labels[language]
  const floorLabel = selectedFloor?.floor_name ?? (selectedFloorId === null ? t.noFloor : `#${selectedFloorId}`)

  const mapMarkers = useMemo<AlignmentMapMarker[]>(() => {
    if (!buildingOrigin) return []
    const markers: AlignmentMapMarker[] = [
      {
        id: 'building-origin',
        label: language === 'ko' ? 'GPS 원점' : 'GPS Origin',
        latitude: buildingOrigin[0],
        longitude: buildingOrigin[1],
        tone: 'origin',
      },
    ]

    pickAnchorMarkers.forEach((marker, index) => {
      const gps = localPointToGps(buildingOrigin, marker.point)
      markers.push({
        id: `anchor-${index}-${marker.label}`,
        label: marker.label.includes('point1') ? 'Point1' : marker.label.includes('point2') ? 'Point2' : marker.label,
        latitude: gps.latitude,
        longitude: gps.longitude,
        tone: markerTone(marker, index),
      })
    })

    return markers
  }, [buildingOrigin, language, pickAnchorMarkers])

  const handleMapPick = (latitude: number, longitude: number) => {
    if (!buildingOrigin) return
    const localPoint = gpsToLocalPoint(buildingOrigin, latitude, longitude)
    const gps: [number, number] = [latitude, longitude]
    handleSceneAnchorPick(localPoint, '3d')
    handleOsmPick(gps, localPoint)
    if (pickMode === 'display') handleOsmHoverPick(gps, localPoint)
  }

  return (
    <section className="ap-alignment-center-panel">
      <header className="alignment-viewer-header">
        <div>
          <p>{t.title}</p>
          <h3>{floorLabel}</h3>
          <span>{t.subtitle}</span>
        </div>
        <div>
          <em>{t.method}: {alignmentMethod}</em>
          <em>{t.view}: {viewMode ?? cameraViewMode}</em>
        </div>
      </header>

      <div className="alignment-viewer-body">
        <div className="alignment-viewer-canvas-wrap" style={{ opacity: Math.max(0.24, Math.min(1, osmQuadOpacity)) }}>
          <Alignment3DViewer
            center={buildingOrigin ?? undefined}
            zoom={osmQuadZoom}
            markers={mapMarkers}
            cameraViewMode={cameraViewMode}
            walls={walls}
            rooms={rooms}
            devices={devices}
            pickLabel={pickMode === 'none' ? t.mapTitle : `${t.pickMode}: ${pickMode}`}
            instruction={t.mapInstruction}
            onPick={handleMapPick}
          />
        </div>

        <div className="alignment-marker-summary">
          <div>
            <strong>{t.pickMode}: {pickMode}</strong>
            <span>{t.markers}: {pickAnchorMarkers.length}</span>
          </div>
          {pickAnchorMarkers.length === 0 ? (
            <p>{t.noMarkers}</p>
          ) : (
            <div>
              {pickAnchorMarkers.map((marker, index) => (
                <span key={`${marker.label}-${index}`} title={`${marker.point[0].toFixed(3)}, ${marker.point[1].toFixed(3)}, ${marker.point[2].toFixed(3)}`}>
                  {marker.kind}: {marker.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
