import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'

type LatLngTuple = [number, number]

export type OsmMapMarker = {
  id: string
  label: string
  latitude: number
  longitude: number
  tone?: 'origin' | 'point1' | 'point2' | 'picked' | 'applied'
}

type Props = {
  center?: LatLngTuple
  zoom?: number
  markers?: OsmMapMarker[]
  pickLabel?: string
  instruction?: string
  readOnly?: boolean
  onPick?: (latitude: number, longitude: number) => void
  onViewChange?: (center: LatLngTuple, zoom: number) => void
}

const TILE_URL = '/api/osm-tiles/{z}/{x}/{y}.png'
const DEFAULT_CENTER: LatLngTuple = [37.5665, 126.9784]
const MIN_ZOOM = 10
const MAX_ZOOM = 18

function latLngToWorldPixel(latitude: number, longitude: number, zoom: number) {
  const sinLat = Math.sin((latitude * Math.PI) / 180)
  const scale = 256 * 2 ** zoom
  const wx = ((longitude + 180) / 360) * scale
  const wy = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  return { wx, wy }
}

function worldPixelToLatLng(wx: number, wy: number, zoom: number) {
  const scale = 256 * 2 ** zoom
  const n = Math.PI - (2 * Math.PI * wy) / scale
  const longitude = (wx / scale) * 360 - 180
  const latitude = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
  return { latitude, longitude }
}

function markerPosition(marker: OsmMapMarker, zoom: number, centerWx: number, centerWy: number, width: number, height: number) {
  const { wx, wy } = latLngToWorldPixel(marker.latitude, marker.longitude, zoom)
  return { left: wx - centerWx + width / 2, top: wy - centerWy + height / 2 }
}

export function OsmTileMapPanel({
  center = DEFAULT_CENTER,
  zoom = 15,
  markers = [],
  pickLabel,
  instruction,
  readOnly = false,
  onPick,
  onViewChange,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const panStart = useRef<{ x: number; y: number; center: LatLngTuple } | null>(null)
  const isPanning = useRef(false)
  const [mapCenter, setMapCenter] = useState<LatLngTuple>(center)
  const [mapZoom, setMapZoom] = useState(zoom)
  const [mapSize, setMapSize] = useState({ width: 800, height: 480 })

  useEffect(() => setMapCenter(center), [center])
  useEffect(() => setMapZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))), [zoom])

  useEffect(() => {
    if (!mapRef.current) return
    const element = mapRef.current
    const updateSize = () => {
      const rect = element.getBoundingClientRect()
      setMapSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) })
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const tileInfo = useMemo(() => {
    const [lat, lng] = mapCenter
    const { wx: centerWx, wy: centerWy } = latLngToWorldPixel(lat, lng, mapZoom)
    const startTx = Math.floor((centerWx - mapSize.width / 2) / 256) - 1
    const endTx = Math.floor((centerWx + mapSize.width / 2) / 256) + 1
    const startTy = Math.floor((centerWy - mapSize.height / 2) / 256) - 1
    const endTy = Math.floor((centerWy + mapSize.height / 2) / 256) + 1
    const tiles: Array<{ url: string; x: number; y: number; left: number; top: number }> = []

    for (let tx = startTx; tx <= endTx; tx += 1) {
      for (let ty = startTy; ty <= endTy; ty += 1) {
        tiles.push({
          url: TILE_URL.replace('{z}', String(mapZoom)).replace('{x}', String(tx)).replace('{y}', String(ty)),
          x: tx,
          y: ty,
          left: tx * 256 - centerWx + mapSize.width / 2,
          top: ty * 256 - centerWy + mapSize.height / 2,
        })
      }
    }

    return { tiles, centerWx, centerWy }
  }, [mapCenter, mapSize.height, mapSize.width, mapZoom])

  const updateView = useCallback((nextCenter: LatLngTuple, nextZoom = mapZoom) => {
    setMapCenter(nextCenter)
    setMapZoom(nextZoom)
    onViewChange?.(nextCenter, nextZoom)
  }, [mapZoom, onViewChange])

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, mapZoom + (event.deltaY > 0 ? -1 : 1)))
    updateView(mapCenter, nextZoom)
  }, [mapCenter, mapZoom, updateView])

  const handleMouseDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 2) return
    panStart.current = { x: event.clientX, y: event.clientY, center: mapCenter }
    isPanning.current = false
  }, [mapCenter])

  const handleMouseMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!panStart.current) return
    const dx = event.clientX - panStart.current.x
    const dy = event.clientY - panStart.current.y
    if (Math.abs(dx) + Math.abs(dy) > 4) isPanning.current = true
    const { wx, wy } = latLngToWorldPixel(panStart.current.center[0], panStart.current.center[1], mapZoom)
    const next = worldPixelToLatLng(wx - dx, wy - dy, mapZoom)
    updateView([next.latitude, next.longitude], mapZoom)
  }, [mapZoom, updateView])

  const finishPan = useCallback(() => {
    window.setTimeout(() => {
      panStart.current = null
      isPanning.current = false
    }, 0)
  }, [])

  const handleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (readOnly || isPanning.current || !mapRef.current || !onPick) return
    const rect = mapRef.current.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    const wx = tileInfo.centerWx + px - rect.width / 2
    const wy = tileInfo.centerWy + py - rect.height / 2
    const point = worldPixelToLatLng(wx, wy, mapZoom)
    onPick(point.latitude, point.longitude)
  }, [mapZoom, onPick, readOnly, tileInfo.centerWx, tileInfo.centerWy])

  return (
    <div
      ref={mapRef}
      className={'osm-tile-map-panel' + (readOnly ? ' read-only' : '')}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={finishPan}
      onMouseLeave={finishPan}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      {tileInfo.tiles.map((tile) => (
        <img
          key={`${tile.x}-${tile.y}`}
          src={tile.url}
          alt=""
          className="osm-tile"
          draggable={false}
          style={{ left: tile.left, top: tile.top }}
        />
      ))}
      <div className="osm-grid-overlay" />
      {markers.map((marker) => {
        const position = markerPosition(marker, mapZoom, tileInfo.centerWx, tileInfo.centerWy, mapSize.width, mapSize.height)
        return (
          <span key={marker.id} className={`osm-map-marker ${marker.tone ?? 'picked'}`} style={{ left: position.left, top: position.top }}>
            <i>{marker.label}</i>
          </span>
        )
      })}
      <div className="osm-map-hud">
        <strong>{pickLabel ?? 'OSM Map Panel'}</strong>
        <span>{mapCenter[0].toFixed(6)}, {mapCenter[1].toFixed(6)} / z{mapZoom}</span>
      </div>
      {instruction && <p className="osm-map-instruction">{instruction}</p>}
    </div>
  )
}
