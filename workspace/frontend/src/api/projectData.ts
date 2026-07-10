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

export type ObjectPlacementCreate = {
  object_type: string
  name: string
  floor_id?: number | null
  source_asset_id?: number | null
  position_x?: number
  position_y?: number
  position_z?: number
  rotation_x?: number
  rotation_y?: number
  rotation_z?: number
  scale_x?: number
  scale_y?: number
  scale_z?: number
  status?: string
  metadata?: Record<string, unknown> | null
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

export async function saveProjectSnapshotSection(
  buildingId: number,
  section: string,
  sectionState: Record<string, unknown>,
  version = 1,
): Promise<ProjectSnapshot> {
  const current = await getProjectSnapshot(buildingId).catch(() => null)
  return saveProjectSnapshot(
    buildingId,
    {
      ...(current?.state ?? {}),
      [section]: sectionState,
    },
    current?.version ?? version,
  )
}

export function listObjectPlacements(buildingId: number): Promise<ObjectPlacement[]> {
  return getJson<ObjectPlacement[]>(`/api/buildings/${buildingId}/object-placements`)
}

export function createObjectPlacement(
  buildingId: number,
  payload: ObjectPlacementCreate,
): Promise<ObjectPlacement> {
  return sendJson<ObjectPlacement, ObjectPlacementCreate>(`/api/buildings/${buildingId}/object-placements`, 'POST', payload)
}

export async function deleteObjectPlacement(placementId: number): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
  const response = await fetch(`${baseUrl}/api/object-placements/${placementId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error(`Delete object placement failed with ${response.status}`)
  }
}
