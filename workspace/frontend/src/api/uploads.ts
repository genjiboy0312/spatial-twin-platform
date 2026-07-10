import { authHeaders, getJson, sendJson } from './client'

export type UploadAsset = {
  id: number
  filename: string
  source_type: string
  building_id: number | null
  floor_id: number | null
  status: string
  message: string | null
  file_url: string | null
  pointcloud_preview_url: string | null
  created_at: string | null
}

export type ProjectAsset = {
  id: number
  building_id: number
  floor_id: number | null
  upload_asset_id: number | null
  asset_type: string
  name: string
  status: string
  file_uri: string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

export type UploadPipeline = {
  upload: UploadAsset
  project_assets: ProjectAsset[]
  next_actions: string[]
  current_stage: string
  progress: number
  details: Record<string, unknown>
}

export type UploadStatus = 'queued' | 'pending' | 'uploaded' | 'validating' | 'processing' | 'converting' | 'preview_ready' | 'ready' | 'failed'

export type UploadAssetCreate = {
  filename: string
  source_type: 'dxf' | 'dwg' | 'image' | 'ifc' | 'glb' | 'pointcloud' | 'unknown'
  building_id?: number
  floor_id?: number
}

export function listUploads(): Promise<UploadAsset[]> {
  return getJson<UploadAsset[]>('/api/uploads')
}

export function listUploadsByBuilding(buildingId: number): Promise<UploadAsset[]> {
  return getJson<UploadAsset[]>(`/api/uploads/by-building/${buildingId}`)
}

export function createUpload(payload: UploadAssetCreate): Promise<UploadAsset> {
  return sendJson<UploadAsset, UploadAssetCreate>('/api/uploads', 'POST', payload)
}

export function getUploadPipeline(uploadId: number): Promise<UploadPipeline> {
  return getJson<UploadPipeline>(`/api/uploads/${uploadId}/pipeline`)
}

export function updateUploadStatus(uploadId: number, status: UploadStatus, message?: string): Promise<UploadPipeline> {
  return sendJson<UploadPipeline, { status: UploadStatus; message?: string }>(`/api/uploads/${uploadId}/status`, 'PATCH', {
    status,
    ...(message === undefined ? {} : { message }),
  })
}

export async function uploadFile(
  file: File,
  sourceType: string,
  buildingId?: number,
  floorId?: number,
): Promise<UploadAsset> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
  const formData = new FormData()
  formData.append('file', file)
  formData.append('source_type', sourceType)
  if (buildingId !== undefined) formData.append('building_id', String(buildingId))
  if (floorId !== undefined) formData.append('floor_id', String(floorId))

  const response = await fetch(`${baseUrl}/api/uploads/file`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  })
  if (!response.ok) {
    throw new Error(`Upload failed with ${response.status}`)
  }
  return response.json() as Promise<UploadAsset>
}

export async function deleteUpload(uploadId: number): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
  const response = await fetch(`${baseUrl}/api/uploads/${uploadId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!response.ok) {
    throw new Error(`Delete upload failed with ${response.status}`)
  }
}
