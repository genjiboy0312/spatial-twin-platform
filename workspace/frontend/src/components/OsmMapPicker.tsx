import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

type Props = {
  open: boolean
  onSelect: (longitude: number, latitude: number) => void
  onClose: () => void
  initialLatitude?: number
  initialLongitude?: number
}

type NominatimResult = {
  display_name: string
  lat: string
  lon: string
}

type LatLng = {
  lat: number
  lng: number
}

type LeafletMap = {
  invalidateSize: () => void
  on: (eventName: string, handler: (event: { latlng: LatLng }) => void) => void
  remove: () => void
  setView: (center: [number, number], zoom?: number) => void
}

type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker
  getLatLng: () => LatLng
  on: (eventName: string, handler: () => void) => void
  setLatLng: (position: [number, number] | LatLng) => void
}

type LeafletInstance = {
  map: (element: HTMLElement, options: { center: [number, number]; zoom: number; zoomControl: boolean }) => LeafletMap
  marker: (position: [number, number], options: { draggable: boolean; autoPan: boolean }) => LeafletMarker
  tileLayer: (url: string, options: { attribution: string; maxZoom: number }) => { addTo: (map: LeafletMap) => void }
}

declare global {
  interface Window {
    L?: LeafletInstance
  }
}

const DEFAULT_LATITUDE = 37.5665
const DEFAULT_LONGITUDE = 126.9784
const DEFAULT_ZOOM = 16
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const LEAFLET_CSS_INTEGRITY = 'sha256-p4NxAoJBhIINfQ+5d6/6GT1UkGg8xW5iJ/JlK4khj0Y='
const LEAFLET_JS_INTEGRITY = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
const LEAFLET_CSS_ID = 'leaflet-cdn-css'
const LEAFLET_SCRIPT_ID = 'leaflet-cdn-script'

function getInitialPosition(initialLatitude?: number, initialLongitude?: number): LatLng {
  return {
    lat: initialLatitude ?? DEFAULT_LATITUDE,
    lng: initialLongitude ?? DEFAULT_LONGITUDE,
  }
}

export function OsmMapPicker({ open, onSelect, onClose, initialLatitude, initialLongitude }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<LeafletMarker | null>(null)

  const [position, setPosition] = useState<LatLng>(() => getInitialPosition(initialLatitude, initialLongitude))
  const [leafletReady, setLeafletReady] = useState(() => Boolean(window.L))
  const [leafletError, setLeafletError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement('link')
      link.id = LEAFLET_CSS_ID
      link.rel = 'stylesheet'
      link.href = LEAFLET_CSS
      link.integrity = LEAFLET_CSS_INTEGRITY
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    }

    if (window.L) {
      setLeafletReady(true)
      return undefined
    }

    let active = true
    let script = document.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null

    const handleLoad = () => {
      script?.setAttribute('data-loaded', 'true')
      if (active) {
        setLeafletReady(true)
        setLeafletError(null)
      }
    }

    const handleError = () => {
      if (active) {
        setLeafletError('Unable to load the map library. Please check your connection and try again.')
      }
    }

    if (!script) {
      script = document.createElement('script')
      script.id = LEAFLET_SCRIPT_ID
      script.src = LEAFLET_JS
      script.async = true
      script.integrity = LEAFLET_JS_INTEGRITY
      script.crossOrigin = 'anonymous'
      document.body.appendChild(script)
    }

    if (script.getAttribute('data-loaded') === 'true') {
      handleLoad()
    } else {
      script.addEventListener('load', handleLoad)
      script.addEventListener('error', handleError)
    }

    return () => {
      active = false
      script?.removeEventListener('load', handleLoad)
      script?.removeEventListener('error', handleError)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    const nextPosition = getInitialPosition(initialLatitude, initialLongitude)
    setPosition(nextPosition)
    setSearchQuery('')
    setSearchResults([])

    if (mapRef.current && markerRef.current) {
      mapRef.current.setView([nextPosition.lat, nextPosition.lng], DEFAULT_ZOOM)
      markerRef.current.setLatLng([nextPosition.lat, nextPosition.lng])
      window.setTimeout(() => mapRef.current?.invalidateSize(), 100)
    }
  }, [initialLatitude, initialLongitude, open])

  useEffect(() => {
    if (!open || !leafletReady || !mapContainerRef.current || mapRef.current) return

    const L = window.L
    if (!L) return

    const startPosition = getInitialPosition(initialLatitude, initialLongitude)
    const map = L.map(mapContainerRef.current, {
      center: [startPosition.lat, startPosition.lng],
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    const marker = L.marker([startPosition.lat, startPosition.lng], {
      draggable: true,
      autoPan: true,
    }).addTo(map)

    marker.on('dragend', () => {
      const nextPosition = marker.getLatLng()
      setPosition({ lat: nextPosition.lat, lng: nextPosition.lng })
    })

    map.on('click', (event) => {
      marker.setLatLng(event.latlng)
      setPosition({ lat: event.latlng.lat, lng: event.latlng.lng })
    })

    mapRef.current = map
    markerRef.current = marker
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 100)

    return () => {
      window.clearTimeout(resizeTimer)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [initialLatitude, initialLongitude, leafletReady, open])

  const moveToPosition = useCallback((nextPosition: LatLng, zoom = DEFAULT_ZOOM) => {
    setPosition(nextPosition)
    markerRef.current?.setLatLng([nextPosition.lat, nextPosition.lng])
    mapRef.current?.setView([nextPosition.lat, nextPosition.lng], zoom)
  }, [])

  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim()
    if (!query) return

    setSearching(true)
    setSearchResults([])

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
      )

      if (!response.ok) {
        throw new Error('Search request failed')
      }

      const results = (await response.json()) as NominatimResult[]
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [searchQuery])

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSearch()
    }
  }

  const handleSelectResult = (result: NominatimResult) => {
    const nextPosition = {
      lat: Number(result.lat),
      lng: Number(result.lon),
    }

    if (!Number.isFinite(nextPosition.lat) || !Number.isFinite(nextPosition.lng)) return

    setSearchQuery(result.display_name)
    setSearchResults([])
    moveToPosition(nextPosition, DEFAULT_ZOOM)
  }

  const handleConfirm = () => {
    onSelect(position.lng, position.lat)
    onClose()
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pick GPS coordinates"
        style={{
          width: '80vw',
          height: '80vh',
          maxWidth: 960,
          maxHeight: 760,
          minWidth: 320,
          minHeight: 420,
          background: '#0b1220',
          color: '#eef2ff',
          border: '1px solid rgba(148,163,184,0.18)',
          borderRadius: 12,
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 16px',
            borderBottom: '1px solid rgba(148,163,184,0.18)',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>Pick GPS Coordinate</div>
          <button
            type="button"
            aria-label="Close map picker"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid rgba(148,163,184,0.18)',
              background: '#07111f',
              color: '#eef2ff',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ position: 'relative', display: 'flex', gap: 8, padding: '12px 16px' }}>
          <input
            type="text"
            placeholder="Search location..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            style={{
              flex: 1,
              minWidth: 0,
              background: '#07111f',
              border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: 6,
              color: '#eef2ff',
              fontSize: 13,
              outline: 'none',
              padding: '8px 12px',
            }}
          />
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
            {searching ? 'Searching...' : 'Search'}
          </button>

          {searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% - 8px)',
                left: 16,
                right: 96,
                zIndex: 10000,
                maxHeight: 220,
                overflowY: 'auto',
                background: '#0f172a',
                border: '1px solid rgba(148,163,184,0.18)',
                borderRadius: 8,
                boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
              }}
            >
              {searchResults.map((result) => (
                <button
                  key={`${result.lat}-${result.lon}-${result.display_name}`}
                  type="button"
                  onClick={() => handleSelectResult(result)}
                  style={{
                    width: '100%',
                    display: 'block',
                    border: 0,
                    borderBottom: '1px solid rgba(148,163,184,0.08)',
                    background: 'transparent',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    fontSize: 12,
                    lineHeight: 1.4,
                    padding: '9px 12px',
                    textAlign: 'left',
                  }}
                >
                  {result.display_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, padding: '0 16px' }}>
          {leafletError ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#07111f',
                border: '1px solid rgba(148,163,184,0.18)',
                borderRadius: 8,
                color: '#fca5a5',
                padding: 16,
                textAlign: 'center',
              }}
            >
              {leafletError}
            </div>
          ) : (
            <div
              ref={mapContainerRef}
              style={{
                width: '100%',
                height: '100%',
                minHeight: 240,
                overflow: 'hidden',
                border: '1px solid rgba(148,163,184,0.18)',
                borderRadius: 8,
                background: '#07111f',
              }}
            />
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 16px',
            borderTop: '1px solid rgba(148,163,184,0.18)',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: 13 }}>
            Latitude: <strong style={{ color: '#eef2ff' }}>{position.lat.toFixed(6)}</strong>, Longitude:{' '}
            <strong style={{ color: '#eef2ff' }}>{position.lng.toFixed(6)}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={!leafletReady || Boolean(leafletError)}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
