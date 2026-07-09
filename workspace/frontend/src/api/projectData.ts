import { getJson, sendJson } from './client'
import type { Building } from './buildings'
import type { Floor } from './floors'
import type { ProjectAsset, UploadAsset } from './uploads'

export type ObjectPlacement = {
  id: number
  building_id: number
  floor_id: number | null
  source_asset_id: number | null
  object_type: string
  name: string
  position_x: number
  position_y: number
  position_z: number
  rotation_x: number
  rotation_y: number
  rotation_z: number
  scale_x: number
  scale_y: number
  scale_z: number
  status: string
  metadata: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

export type ProjectSecurityDevice = {
  id: number
  floor_id: number
  name: string
  device_type: string
  pos_x: number
  pos_y: number
  angle: number
  status: string
  meta: string | null
  created_at: string | null
  updated_at: string | null
}

export type ProjectData = {
  building: Building
  floors: Floor[]
  uploads: UploadAsset[]
  project_assets: ProjectAsset[]
  object_placements: ObjectPlacement[]
  security_devices: ProjectSecurityDevice[]
  asset_counts: Record<string, number>
}

export type ProjectSnapshot = {
  building_id: number
  version: number
  state: Record<string, unknown>
  saved: boolean
  updated_at: string | null
}

export function getProjectData(buildingId: number): Promise<ProjectData> {
  return getJson<ProjectData>(`/api/buildings/${buildingId}/project-data`)
}

export function getProjectSnapshot(buildingId: number): Promise<ProjectSnapshot> {
  return getJson<ProjectSnapshot>(`/api/buildings/${buildingId}/project-snapshot`)
}

export function saveProjectSnapshot(
  buildingId: number,
  state: Record<string, unknown>,
  version = 1,
): Promise<ProjectSnapshot> {
  return sendJson<ProjectSnapshot, { version: number; state: Record<string, unknown> }>(
    `/api/buildings/${buildingId}/project-snapshot`,
    'PUT',
    { version, state },
  )
}
