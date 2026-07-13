import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type WheelEvent } from 'react'
import { Modal } from '../../../components/Modal'

type Language = 'ko' | 'en'

// ─── OSM Tile Utilities ───────────────────────────────────────────────────────

/** lat/lng → world pixel coordinates at zoom level */
function latLngToWorldPixel(lat: number, lng: number, zoom: number): { wx: number; wy: number } {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const wx = ((lng + 180) / 360) * 256 * Math.pow(2, zoom);
  const wy =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
    256 *
    Math.pow(2, zoom);
  return { wx, wy };
}

/** world pixel → lat/lng */
function worldPixelToLatLng(wx: number, wy: number, zoom: number): { lat: number; lng: number } {
  const n = Math.PI - (2 * Math.PI * wy) / (256 * Math.pow(2, zoom));
  const lng = (wx / (256 * Math.pow(2, zoom))) * 360 - 180;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

const TILE_URL = '/api/osm-tiles/{z}/{x}/{y}.png';

const koreanRegions = [
  { province: '서울특별시', districts: [
    { district: '강남구', towns: ['역삼동', '삼성동', '대치동', '청담동', '압구정동'] },
    { district: '중구', towns: ['명동', '을지로', '충무로'] },
    { district: '마포구', towns: ['상암동', '합정동', '홍대입구'] },
  ]},
  { province: '경기도', districts: [
    { district: '성남시 분당구', towns: ['삼평동', '백현동', '정자동'] },
    { district: '수원시 영통구', towns: ['이의동', '영통동'] },
  ]},
  { province: '부산광역시', districts: [
    { district: '해운대구', towns: ['우동', '중동'] },
  ]},
  { province: '대전광역시', districts: [
    { district: '유성구', towns: ['도룡동'] },
  ]},
]

const REGION_CENTERS: Record<string, [number, number]> = {
  서울특별시: [37.5665, 126.9784],
  경기도: [37.4138, 127.5183],
  부산광역시: [35.1796, 129.0756],
  대전광역시: [36.3504, 127.3845],
}

const DISTRICT_CENTERS: Record<string, [number, number]> = {
  강남구: [37.5172, 127.0473],
  중구: [37.5637, 126.9987],
  마포구: [37.5638, 126.9084],
  '성남시 분당구': [37.3827, 127.1189],
  '수원시 영통구': [37.2595, 127.0466],
  해운대구: [35.1631, 129.1636],
  유성구: [36.3622, 127.3564],
}

const TOWN_CENTERS: Record<string, [number, number]> = {
  역삼동: [37.5007, 127.0365],
  삼성동: [37.5145, 127.0565],
  대치동: [37.4946, 127.0634],
  청담동: [37.5236, 127.0499],
  압구정동: [37.5271, 127.0286],
  명동: [37.5637, 126.9850],
  을지로: [37.5663, 126.9919],
  충무로: [37.5610, 126.9941],
  상암동: [37.5793, 126.8890],
  합정동: [37.5496, 126.9140],
  홍대입구: [37.5572, 126.9245],
  삼평동: [37.4021, 127.1086],
  백현동: [37.3916, 127.1112],
  정자동: [37.3665, 127.1080],
  이의동: [37.2910, 127.0536],
  영통동: [37.2515, 127.0719],
  우동: [35.1631, 129.1635],
  중동: [35.1632, 129.1698],
  도룡동: [36.3750, 127.3810],
}

interface OSMOriginPickerPopupProps {
  open: boolean
  onClose: () => void
  currentOrigin: [number, number] | null
  onConfirm: (origin: [number, number], addressLabel: string) => void
  language?: Language
}

interface GeocodeResult {
  lat: number
  lng: number
  displayName: string
  address?: Record<string, string>
}

interface NominatimItem {
  lat?: string
  lon?: string
  display_name?: string
  address?: Record<string, string | undefined>
}

type RegionSelection = {
  province: string
  district?: string
  town?: string
}

const labels = {
  ko: {
    title: 'OSM 원점 선택',
    description: '행정구역 선택, 주소 검색, 지도 클릭으로 원점을 설정합니다.',
    searchPlaceholder: '주소 또는 장소명을 입력하세요',
    searchButton: '검색',
    searching: '검색 중...',
    noSearchResults: '검색 결과가 없습니다. 행정구역 목록을 사용하세요.',
    regionLabel: '시/도',
    districtLabel: '시/군/구',
    townLabel: '읍/면/동',
    selectPlaceholder: '선택하세요',
    pickOnMapOption: '지도에서 직접 선택',
    selectedOrigin: '선택된 원점',
    emptySelection: '지도 클릭 또는 목록 선택으로 원점을 지정하세요.',
    geocoding: '주소 확인 중...',
    geocodeError: 'Nominatim 응답이 없어 내장 지역 목록으로 대체했습니다.',
    processing: '처리 중...',
    mapInstructionClick: '왼쪽 클릭: 원점 선택',
    mapInstructionNavigation: '마우스 휠: 줌 / 오른쪽 드래그: 이동',
    zoom: '줌',
    cancel: '취소',
    confirm: '선택 완료',
    current: '현재',
    searchResults: '검색 결과',
  },
  en: {
    title: 'OSM Origin Picker',
    description: 'Set the origin by administrative region, address search, or map click.',
    searchPlaceholder: 'Enter an address or place name',
    searchButton: 'Search',
    searching: 'Searching...',
    noSearchResults: 'No search results. Use the administrative region list instead.',
    regionLabel: 'Province',
    districtLabel: 'District',
    townLabel: 'Neighborhood',
    selectPlaceholder: 'Select',
    pickOnMapOption: 'Pick directly on map',
    selectedOrigin: 'Selected origin',
    emptySelection: 'Click the map or select a region to set the origin.',
    geocoding: 'Resolving address...',
    geocodeError: 'Nominatim did not respond, so the built-in region list was used.',
    processing: 'Processing...',
    mapInstructionClick: 'Left click: pick origin',
    mapInstructionNavigation: 'Mouse wheel: zoom / right drag: pan',
    zoom: 'Zoom',
    cancel: 'Cancel',
    confirm: 'Confirm',
    current: 'Current',
    searchResults: 'Search results',
  },
}

const PICKER_STYLES = `
.modal:has(.ap-origin-picker-popup) { width: 94vw; max-width: min(1120px, 94vw); }
.ap-origin-picker-popup { display: grid; gap: 16px; color: var(--text); }
.ap-origin-copy { margin: -6px 0 0; color: var(--muted); font-size: 0.8rem; line-height: 1.5; }
.ap-origin-body { display: grid; grid-template-columns: 330px minmax(0, 1fr); gap: 18px; min-height: 580px; }
.ap-origin-sidebar { display: flex; min-width: 0; flex-direction: column; gap: 12px; }
.ap-origin-field { display: grid; gap: 5px; }
.ap-origin-label { color: var(--muted); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.02em; }
.ap-origin-input, .ap-origin-select { width: 100%; border: 1px solid var(--border); border-radius: 10px; background: color-mix(in srgb, var(--bg) 72%, transparent); color: var(--text); padding: 9px 10px; font: inherit; font-size: 0.82rem; outline: none; }
.ap-origin-input:focus, .ap-origin-select:focus { border-color: rgba(59,130,246,0.58); box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
.ap-origin-input-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 7px; }
.ap-origin-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--border); border-radius: 10px; background: color-mix(in srgb, var(--bg-panel-2) 82%, transparent); color: var(--text); min-height: 38px; padding: 8px 12px; font: inherit; font-size: 0.82rem; font-weight: 800; cursor: pointer; transition: transform 0.15s, background 0.15s, border-color 0.15s, opacity 0.15s; }
.ap-origin-button:hover:not(:disabled) { transform: translateY(-1px); border-color: var(--border-strong); background: color-mix(in srgb, var(--bg-panel-2) 96%, transparent); }
.ap-origin-button:disabled { cursor: not-allowed; opacity: 0.48; transform: none; }
.ap-origin-button-primary { border-color: rgba(59,130,246,0.42); background: #2563eb; color: #fff; }
.ap-origin-button-primary:hover:not(:disabled) { background: #1d4ed8; }
.ap-origin-search-wrap { position: relative; }
.ap-origin-results { position: absolute; z-index: 40; top: calc(100% + 5px); right: 0; left: 0; overflow: auto; max-height: 220px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--bg-panel) 98%, black 6%); box-shadow: 0 18px 60px rgba(0,0,0,0.36); }
.ap-origin-result { display: block; width: 100%; border: 0; border-bottom: 1px solid var(--border); background: transparent; color: var(--text); padding: 9px 10px; text-align: left; font: inherit; font-size: 0.74rem; cursor: pointer; }
.ap-origin-result:hover { background: color-mix(in srgb, var(--bg-panel-2) 74%, transparent); }
.ap-origin-result:last-child { border-bottom: 0; }
.ap-origin-coords { display: grid; gap: 5px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--bg-panel-2) 62%, transparent); padding: 11px; }
.ap-origin-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.ap-origin-muted { color: var(--muted); font-size: 0.74rem; line-height: 1.45; }
.ap-origin-error { color: #fca5a5; font-size: 0.74rem; line-height: 1.45; }
.ap-origin-map-column { display: grid; min-width: 0; grid-template-rows: minmax(0, 1fr) auto; gap: 10px; }
.ap-origin-map { position: relative; min-height: 680px; overflow: hidden; border: 1px solid var(--border); border-radius: 14px; background: #0a0a14; user-select: none; }
.ap-origin-tile { position: absolute; width: 256px; height: 256px; pointer-events: none; }
@media (max-width: 920px) { .ap-origin-body { grid-template-columns: 1fr; } .ap-origin-map { min-height: 520px; } }
.ap-origin-grid { position: absolute; inset: 0; z-index: 10; pointer-events: none; background-image: linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px); background-size: 64px 64px; }
.ap-origin-marker { position: absolute; z-index: 20; transform: translate(-50%, -100%); color: #facc15; font-size: 28px; filter: drop-shadow(0 0 7px rgba(250,204,21,0.72)); pointer-events: none; }
.ap-origin-loading { position: absolute; top: 12px; right: 12px; z-index: 30; border: 1px solid rgba(255,255,255,0.12); border-radius: 9px; background: rgba(0,0,0,0.62); color: rgba(255,255,255,0.76); padding: 7px 9px; font-size: 0.72rem; font-weight: 800; backdrop-filter: blur(10px); }
.ap-origin-help { position: absolute; right: 0; bottom: 0; left: 0; z-index: 30; padding: 34px 14px 13px; pointer-events: none; background: linear-gradient(to top, rgba(0,0,0,0.86), rgba(0,0,0,0.5) 58%, transparent); color: rgba(255,255,255,0.9); font-size: 0.8rem; line-height: 1.5; }
.ap-origin-map-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--muted); font-size: 0.74rem; }
.ap-origin-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 9px; border-top: 1px solid var(--border); padding-top: 12px; }
@media (max-width: 920px) { .ap-origin-body { grid-template-columns: 1fr; } .ap-origin-map { min-height: 420px; } }
`

function cleanAddress(address: Record<string, string | undefined> | undefined) {
  if (!address) return undefined
  const entries = Object.entries(address).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  return Object.fromEntries(entries)
}

function toGeocodeResult(item: NominatimItem): GeocodeResult | null {
  const lat = Number(item.lat)
  const lng = Number(item.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const result: GeocodeResult = {
    lat,
    lng,
    displayName: item.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
  }
  const address = cleanAddress(item.address)
  if (address) result.address = address
  return result
}

async function forwardGeocode(query: string, limit = 8): Promise<GeocodeResult[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}&accept-language=ko&q=${encodeURIComponent(query)}`
    const response = await fetch(url)
    if (!response.ok) return []
    const data = (await response.json()) as NominatimItem[]
    return data.map(toGeocodeResult).filter((result): result is GeocodeResult => result !== null)
  } catch {
    return []
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=ko&lat=${lat}&lon=${lng}`
    const response = await fetch(url)
    if (!response.ok) return null
    return toGeocodeResult((await response.json()) as NominatimItem)
  } catch {
    return null
  }
}

function normalizeName(value: string) {
  return value.replace(/\s/g, '').toLowerCase()
}

function namesMatch(candidate: string | undefined, expected: string) {
  if (!candidate) return false
  const normalizedCandidate = normalizeName(candidate)
  const normalizedExpected = normalizeName(expected)
  return normalizedCandidate === normalizedExpected || normalizedCandidate.includes(normalizedExpected) || normalizedExpected.includes(normalizedCandidate)
}

function addressCandidates(address: Record<string, string> | undefined, keys: string[]) {
  if (!address) return []
  return keys.map((key) => address[key]).filter((value): value is string => Boolean(value))
}

function selectionFromAddress(address: Record<string, string> | undefined): RegionSelection | null {
  const provinceCandidates = addressCandidates(address, ['province', 'state', 'city'])
  const districtCandidates = addressCandidates(address, ['city_district', 'borough', 'county', 'district', 'municipality', 'city'])
  const townCandidates = addressCandidates(address, ['suburb', 'quarter', 'neighbourhood', 'neighborhood', 'village', 'town'])

  const region = koreanRegions.find((item) => provinceCandidates.some((candidate) => namesMatch(candidate, item.province)))
  if (!region) return null

  const selection: RegionSelection = { province: region.province }
  const district = region.districts.find((item) => districtCandidates.some((candidate) => namesMatch(candidate, item.district)))
  if (!district) return selection

  selection.district = district.district
  const town = district.towns.find((item) => townCandidates.some((candidate) => namesMatch(candidate, item)))
  if (town) selection.town = town
  return selection
}

const FALLBACK_POINTS: Array<RegionSelection & { lat: number; lng: number }> = [
  { province: '서울특별시', lat: 37.5665, lng: 126.9784 },
  { province: '경기도', lat: 37.4138, lng: 127.5183 },
  { province: '부산광역시', lat: 35.1796, lng: 129.0756 },
  { province: '대전광역시', lat: 36.3504, lng: 127.3845 },
  { province: '서울특별시', district: '강남구', town: '역삼동', lat: 37.5007, lng: 127.0365 },
  { province: '서울특별시', district: '강남구', town: '삼성동', lat: 37.5145, lng: 127.0565 },
  { province: '서울특별시', district: '강남구', town: '대치동', lat: 37.4946, lng: 127.0634 },
  { province: '서울특별시', district: '강남구', town: '청담동', lat: 37.5236, lng: 127.0499 },
  { province: '서울특별시', district: '중구', town: '명동', lat: 37.5637, lng: 126.9850 },
  { province: '서울특별시', district: '마포구', town: '상암동', lat: 37.5793, lng: 126.8890 },
  { province: '경기도', district: '성남시 분당구', town: '삼평동', lat: 37.4021, lng: 127.1086 },
  { province: '경기도', district: '수원시 영통구', town: '이의동', lat: 37.2910, lng: 127.0536 },
  { province: '부산광역시', district: '해운대구', town: '우동', lat: 35.1631, lng: 129.1635 },
  { province: '대전광역시', district: '유성구', town: '도룡동', lat: 36.3750, lng: 127.3810 },
]

function nearestSelection(lat: number, lng: number): RegionSelection | null {
  let best: (RegionSelection & { lat: number; lng: number }) | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const point of FALLBACK_POINTS) {
    const score = (point.lat - lat) ** 2 + (point.lng - lng) ** 2
    if (score < bestScore) {
      bestScore = score
      best = point
    }
  }
  if (!best) return null
  const selection: RegionSelection = { province: best.province }
  if (best.district) selection.district = best.district
  if (best.town) selection.town = best.town
  return selection
}

function centerForSelection(selection: RegionSelection) {
  if (selection.town && TOWN_CENTERS[selection.town]) return TOWN_CENTERS[selection.town]
  if (selection.district && DISTRICT_CENTERS[selection.district]) return DISTRICT_CENTERS[selection.district]
  return REGION_CENTERS[selection.province] ?? null
}

export function OSMOriginPickerPopup({
  open,
  onClose,
  currentOrigin,
  onConfirm,
  language = 'ko',
}: OSMOriginPickerPopupProps) {
  const t = labels[language]
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedTown, setSelectedTown] = useState('')
  const [mapZoom, setMapZoom] = useState(13)
  const [mapCenter, setMapCenter] = useState<[number, number]>([37.5665, 126.9784])
  const [pickedGps, setPickedGps] = useState<[number, number] | null>(null)
  const [pickedAddress, setPickedAddress] = useState('')
  const [mapSize, setMapSize] = useState({ width: 800, height: 540 })
  const [isDragging, setIsDragging] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const panStart = useRef<{ x: number; y: number; center: [number, number] } | null>(null)

  const MAX_ZOOM = 19
  const MIN_ZOOM = 10
  const REGION_ZOOM = 11
  const DISTRICT_ZOOM = 13
  const TOWN_ZOOM = 18

  const updateMapSize = useCallback(() => {
    if (!mapRef.current) return null
    const rect = mapRef.current.getBoundingClientRect()
    const nextSize = {
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    }
    setMapSize((current) => (
      Math.abs(current.width - nextSize.width) > 0.5 || Math.abs(current.height - nextSize.height) > 0.5
        ? nextSize
        : current
    ))
    return { rect, size: nextSize }
  }, [])

  const currentRegion = useMemo(
    () => koreanRegions.find((region) => region.province === selectedRegion) ?? null,
    [selectedRegion],
  )

  const currentDistrict = useMemo(() => {
    if (!currentRegion) return null
    return currentRegion.districts.find((district) => district.district === selectedDistrict) ?? null
  }, [currentRegion, selectedDistrict])

  const towns = currentDistrict?.towns ?? []

  const focusMap = useCallback((lat: number, lng: number, zoom: number) => {
    setMapCenter([lat, lng])
    setMapZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)))
  }, [])

  const applySelection = useCallback((selection: RegionSelection | null) => {
    if (!selection) return
    setSelectedRegion(selection.province)
    setSelectedDistrict(selection.district ?? '')
    setSelectedTown(selection.town ?? '')
  }, [])

  useEffect(() => {
    if (!open || !mapRef.current) return
    const element = mapRef.current
    updateMapSize()
    const observer = new ResizeObserver(() => updateMapSize())
    observer.observe(element)
    return () => observer.disconnect()
  }, [open, updateMapSize])

  useEffect(() => {
    if (open && currentOrigin) {
      setMapCenter(currentOrigin)
      setMapZoom(TOWN_ZOOM)
      setPickedGps(currentOrigin)
      setPickedAddress(`${currentOrigin[0].toFixed(6)}, ${currentOrigin[1].toFixed(6)}`)
    } else if (open) {
      setMapCenter([37.5665, 126.9784])
      setMapZoom(REGION_ZOOM)
      setPickedGps(null)
      setPickedAddress('')
    }
    if (!open) {
      setSelectedRegion('')
      setSelectedDistrict('')
      setSelectedTown('')
      setPickedAddress('')
      setGeocodeError(null)
      setSearchQuery('')
      setSearchResults([])
      setShowSearchResults(false)
      setIsDragging(false)
      isPanning.current = false
      panStart.current = null
    }
  }, [open, currentOrigin])

  const tileInfo = useMemo(() => {
    const [lat, lng] = mapCenter
    const { wx: centerWx, wy: centerWy } = latLngToWorldPixel(lat, lng, mapZoom)
    const startTx = Math.floor((centerWx - mapSize.width / 2) / 256) - 1
    const endTx = Math.floor((centerWx + mapSize.width / 2) / 256) + 1
    const startTy = Math.floor((centerWy - mapSize.height / 2) / 256) - 1
    const endTy = Math.floor((centerWy + mapSize.height / 2) / 256) + 1

    const tiles: Array<{ url: string; x: number; y: number; left: number; top: number }> = []
    const tileCount = 2 ** mapZoom
    for (let tx = startTx; tx <= endTx; tx += 1) {
      for (let ty = startTy; ty <= endTy; ty += 1) {
        if (ty < 0 || ty >= tileCount) continue
        const wrappedX = ((tx % tileCount) + tileCount) % tileCount
        tiles.push({
          url: TILE_URL.replace('{z}', String(mapZoom)).replace('{x}', String(wrappedX)).replace('{y}', String(ty)),
          x: tx,
          y: ty,
          left: tx * 256 - centerWx + mapSize.width / 2,
          top: ty * 256 - centerWy + mapSize.height / 2,
        })
      }
    }

    return { tiles, centerWx, centerWy }
  }, [mapCenter, mapSize.height, mapSize.width, mapZoom])

  const handleMapClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (isPanning.current || !mapRef.current) return
      const measured = updateMapSize()
      const rect = measured?.rect ?? mapRef.current.getBoundingClientRect()
      const width = measured?.size.width ?? mapSize.width
      const height = measured?.size.height ?? mapSize.height
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const wx = tileInfo.centerWx + px - width / 2
      const wy = tileInfo.centerWy + py - height / 2
      const { lat, lng } = worldPixelToLatLng(wx, wy, mapZoom)
      setPickedGps([lat, lng])
      setIsGeocoding(true)
      setGeocodeError(null)

      reverseGeocode(lat, lng)
        .then((result) => {
          if (result) {
            setPickedAddress(result.displayName)
            applySelection(selectionFromAddress(result.address) ?? nearestSelection(lat, lng))
          } else {
            setPickedAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
            setGeocodeError(t.geocodeError)
            applySelection(nearestSelection(lat, lng))
          }
        })
        .catch(() => {
          setPickedAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
          setGeocodeError(t.geocodeError)
          applySelection(nearestSelection(lat, lng))
        })
        .finally(() => setIsGeocoding(false))
    },
    [applySelection, mapSize.height, mapSize.width, mapZoom, t.geocodeError, tileInfo, updateMapSize],
  )

  const handleWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const delta = event.deltaY > 0 ? -1 : 1
    setMapZoom((zoom) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta)))
  }, [])

  const handleMouseDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 2) return
    event.preventDefault()
    isPanning.current = true
    setIsDragging(true)
    panStart.current = { x: event.clientX, y: event.clientY, center: [...mapCenter] }
  }, [mapCenter])

  const handleMouseMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!isPanning.current || !panStart.current) return
    const dx = event.clientX - panStart.current.x
    const dy = event.clientY - panStart.current.y
    const [centerLat, centerLng] = panStart.current.center
    const { wx: cWx, wy: cWy } = latLngToWorldPixel(centerLat, centerLng, mapZoom)
    const { lat: newLat, lng: newLng } = worldPixelToLatLng(cWx - dx, cWy - dy, mapZoom)
    setMapCenter([newLat, newLng])
  }, [mapZoom])

  const stopPanning = useCallback(() => {
    isPanning.current = false
    setIsDragging(false)
    panStart.current = null
  }, [])

  const handleMouseUp = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.button === 2) stopPanning()
  }, [stopPanning])

  const handleContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
  }, [])

  const handleRegionChange = useCallback(async (regionName: string) => {
    setSelectedRegion(regionName)
    setSelectedDistrict('')
    setSelectedTown('')
    setGeocodeError(null)
    if (!regionName) return

    setIsGeocoding(true)
    const [fallbackLat, fallbackLng] = REGION_CENTERS[regionName] ?? [37.5665, 126.9784]
    try {
      const result = (await forwardGeocode(`${regionName}, 대한민국`, 1))[0]
      const lat = result?.lat ?? fallbackLat
      const lng = result?.lng ?? fallbackLng
      focusMap(lat, lng, REGION_ZOOM)
      setPickedGps([lat, lng])
      setPickedAddress(result?.displayName ?? regionName)
    } catch {
      focusMap(fallbackLat, fallbackLng, REGION_ZOOM)
      setPickedGps([fallbackLat, fallbackLng])
      setPickedAddress(regionName)
      setGeocodeError(t.geocodeError)
    } finally {
      setIsGeocoding(false)
    }
  }, [focusMap, t.geocodeError])

  const handleDistrictChange = useCallback(async (districtName: string) => {
    setSelectedDistrict(districtName)
    setSelectedTown('')
    setGeocodeError(null)
    if (!selectedRegion || !districtName) return

    setIsGeocoding(true)
    const [fallbackLat, fallbackLng] = DISTRICT_CENTERS[districtName] ?? REGION_CENTERS[selectedRegion] ?? [37.5665, 126.9784]
    try {
      const result = (await forwardGeocode(`${districtName}, ${selectedRegion}, 대한민국`, 1))[0]
      const lat = result?.lat ?? fallbackLat
      const lng = result?.lng ?? fallbackLng
      focusMap(lat, lng, DISTRICT_ZOOM)
      setPickedGps([lat, lng])
      setPickedAddress(result?.displayName ?? `${selectedRegion} ${districtName}`)
    } catch {
      focusMap(fallbackLat, fallbackLng, DISTRICT_ZOOM)
      setPickedGps([fallbackLat, fallbackLng])
      setPickedAddress(`${selectedRegion} ${districtName}`)
      setGeocodeError(t.geocodeError)
    } finally {
      setIsGeocoding(false)
    }
  }, [focusMap, selectedRegion, t.geocodeError])

  const handleTownChange = useCallback(async (townName: string) => {
    setSelectedTown(townName)
    setGeocodeError(null)
    if (!selectedRegion || !selectedDistrict || !townName) return

    setIsGeocoding(true)
    const [fallbackLat, fallbackLng] = TOWN_CENTERS[townName] ?? DISTRICT_CENTERS[selectedDistrict] ?? [37.5665, 126.9784]
    try {
      const result = (await forwardGeocode(`${townName}, ${selectedDistrict}, ${selectedRegion}, 대한민국`, 1))[0]
      const lat = result?.lat ?? fallbackLat
      const lng = result?.lng ?? fallbackLng
      focusMap(lat, lng, TOWN_ZOOM)
      setPickedGps([lat, lng])
      setPickedAddress(result?.displayName ?? `${selectedRegion} ${selectedDistrict} ${townName}`)
    } catch {
      focusMap(fallbackLat, fallbackLng, TOWN_ZOOM)
      setPickedGps([fallbackLat, fallbackLng])
      setPickedAddress(`${selectedRegion} ${selectedDistrict} ${townName}`)
      setGeocodeError(t.geocodeError)
    } finally {
      setIsGeocoding(false)
    }
  }, [focusMap, selectedDistrict, selectedRegion, t.geocodeError])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    setShowSearchResults(true)
    setGeocodeError(null)
    const results = await forwardGeocode(searchQuery, 8)
    setSearchResults(results)
    if (results.length === 0) setGeocodeError(t.noSearchResults)
    setIsSearching(false)
  }, [searchQuery, t.noSearchResults])

  const handleSearchResultClick = useCallback((result: GeocodeResult) => {
    focusMap(result.lat, result.lng, TOWN_ZOOM)
    setPickedGps([result.lat, result.lng])
    setPickedAddress(result.displayName)
    applySelection(selectionFromAddress(result.address) ?? nearestSelection(result.lat, result.lng))
    setShowSearchResults(false)
    setSearchQuery(result.displayName)
  }, [applySelection, focusMap])

  const handleConfirm = useCallback(() => {
    if (!pickedGps) return
    onConfirm(pickedGps, pickedAddress || `${pickedGps[0].toFixed(6)}, ${pickedGps[1].toFixed(6)}`)
  }, [onConfirm, pickedAddress, pickedGps])

  return (
    <Modal isOpen={open} onClose={onClose} title={t.title}>
      <style>{PICKER_STYLES}</style>
      <div className="editor-popup ap-origin-picker-popup">
        <p className="ap-origin-copy">{t.description}</p>

        <div className="ap-origin-body">
          <div className="ap-origin-sidebar">
            <div className="ap-origin-search-wrap">
              <label className="ap-origin-label" htmlFor="osm-origin-search">🔍 {t.searchResults}</label>
              <div className="ap-origin-input-row" style={{ marginTop: 5 }}>
                <input
                  id="osm-origin-search"
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void handleSearch() }}
                  placeholder={t.searchPlaceholder}
                  className="ap-origin-input"
                />
                <button type="button" className="ap-origin-button ap-origin-button-primary" onClick={() => void handleSearch()} disabled={isSearching}>
                  {isSearching ? '...' : '🔍'} {isSearching ? t.searching : t.searchButton}
                </button>
              </div>
              {showSearchResults && searchResults.length > 0 && (
                <div className="ap-origin-results">
                  {searchResults.map((result, index) => (
                    <button key={`${result.lat}-${result.lng}-${index}`} type="button" className="ap-origin-result" onClick={() => handleSearchResultClick(result)}>
                      <span className="ap-origin-mono" style={{ color: 'var(--dim)', fontSize: '0.68rem' }}>{result.lat.toFixed(5)}, {result.lng.toFixed(5)}</span>
                      <br />
                      {result.displayName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="ap-origin-field">
              <label className="ap-origin-label" htmlFor="osm-origin-region">{t.regionLabel}</label>
              <select id="osm-origin-region" className="ap-origin-select" value={selectedRegion} onChange={(event) => { void handleRegionChange(event.target.value) }}>
                <option value="">{t.selectPlaceholder}</option>
                {koreanRegions.map((region) => (
                  <option key={region.province} value={region.province}>{region.province}</option>
                ))}
              </select>
            </div>

            <div className="ap-origin-field">
              <label className="ap-origin-label" htmlFor="osm-origin-district">{t.districtLabel}</label>
              <select id="osm-origin-district" className="ap-origin-select" value={selectedDistrict} onChange={(event) => { void handleDistrictChange(event.target.value) }} disabled={!currentRegion}>
                <option value="">{t.selectPlaceholder}</option>
                {currentRegion?.districts.map((district) => (
                  <option key={district.district} value={district.district}>{district.district}</option>
                ))}
              </select>
            </div>

            <div className="ap-origin-field">
              <label className="ap-origin-label" htmlFor="osm-origin-town">{t.townLabel}</label>
              <select id="osm-origin-town" className="ap-origin-select" value={selectedTown} onChange={(event) => { void handleTownChange(event.target.value) }} disabled={!currentDistrict}>
                <option value="">{t.selectPlaceholder}</option>
                {towns.length > 0 ? (
                  towns.map((town) => <option key={town} value={town}>{town}</option>)
                ) : (
                  <option value="" disabled>{t.pickOnMapOption}</option>
                )}
              </select>
            </div>

            <div className="ap-origin-coords">
              <span className="ap-origin-label">📍 {t.selectedOrigin}</span>
              {pickedGps ? (
                <>
                  <strong className="ap-origin-mono" style={{ color: '#facc15', fontSize: '0.9rem' }}>{pickedGps[0].toFixed(7)}, {pickedGps[1].toFixed(7)}</strong>
                  {pickedAddress && <span className="ap-origin-muted">{pickedAddress}</span>}
                  {isGeocoding && <span className="ap-origin-muted">... {t.geocoding}</span>}
                  {geocodeError && <span className="ap-origin-error">{geocodeError}</span>}
                </>
              ) : (
                <span className="ap-origin-muted">{t.emptySelection}</span>
              )}
            </div>
          </div>

          <div className="ap-origin-map-column">
            <div
              ref={mapRef}
              className="ap-origin-map"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={stopPanning}
              onContextMenu={handleContextMenu}
              onClick={handleMapClick}
              style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
            >
{tileInfo.tiles.map((tile) => (
  <img
    key={`tile-${tile.x}-${tile.y}`}
    src={tile.url}
    alt=""
    className="ap-origin-tile"
    style={{ left: tile.left, top: tile.top }}
    draggable={false}
    onError={(e) => {
      e.currentTarget.style.visibility = 'hidden'
    }}
  />
))}
              <div className="ap-origin-grid" />
              {pickedGps && (() => {
                const { wx: pickedWx, wy: pickedWy } = latLngToWorldPixel(pickedGps[0], pickedGps[1], mapZoom)
                const left = pickedWx - tileInfo.centerWx + mapSize.width / 2
                const top = pickedWy - tileInfo.centerWy + mapSize.height / 2
                return <div className="ap-origin-marker" style={{ left, top }}>📍</div>
              })()}
              {isGeocoding && <div className="ap-origin-loading">... {t.processing}</div>}
              <div className="ap-origin-help">
                {t.mapInstructionClick}<br />{t.mapInstructionNavigation}
              </div>
            </div>
            <div className="ap-origin-map-footer">
              <span className="ap-origin-mono">{t.current}: {mapCenter[0].toFixed(6)}, {mapCenter[1].toFixed(6)}</span>
              <span>{t.zoom} {mapZoom}</span>
            </div>
          </div>
        </div>

        <div className="ap-origin-actions">
          <button type="button" className="ap-origin-button" onClick={onClose}>× {t.cancel}</button>
          <button type="button" className="ap-origin-button ap-origin-button-primary" onClick={handleConfirm} disabled={!pickedGps}>✓ {t.confirm}</button>
        </div>
      </div>
    </Modal>
  )
}

export default OSMOriginPickerPopup
