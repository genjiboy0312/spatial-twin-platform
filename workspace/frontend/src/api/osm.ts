import { getJson, sendJson } from './client'

export type OsmTileStatus = {
  provider: string
  provider_url_template: string
  cache_enabled: boolean
  cache_dir: string
  cache_ttl_seconds: number
  fallback_enabled: boolean
}

export type GpsAccuracyMetadata = {
  quality: 'excellent' | 'good' | 'review' | 'poor'
  point_count: number
  rmse: number
  rmse_meters: number
  mean_error_meters: number
  max_error_meters: number
}

export type AlignmentAuditLog = {
  id: number
  building_id: number
  action: string
  point_count: number
  rmse: number | null
  accuracy: GpsAccuracyMetadata | null
  metadata: Record<string, unknown> | null
  created_at: string | null
}

export type GpsControlPoint = {
  local: [number, number]
  gps: [number, number]
}

export type GpsThreePointResponse = {
  building_id: number
  transform_matrix: number[][]
  rmse: number
  accuracy: GpsAccuracyMetadata
}

export function getOsmTileStatus(): Promise<OsmTileStatus> {
  return getJson<OsmTileStatus>('/api/osm-tiles/status')
}

export function computeThreePointAlignment(buildingId: number, points: GpsControlPoint[]): Promise<GpsThreePointResponse> {
  return sendJson<GpsThreePointResponse, { building_id: number; points: GpsControlPoint[] }>(
    '/api/gps-alignment/three-point',
    'POST',
    { building_id: buildingId, points },
  )
}

export function listAlignmentAuditLogs(buildingId: number): Promise<AlignmentAuditLog[]> {
  return getJson<AlignmentAuditLog[]>(`/api/gps-alignment/buildings/${buildingId}/audit-logs`)
}
