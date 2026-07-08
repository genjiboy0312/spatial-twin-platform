import { getJson, sendJson } from './client'

export type UploadAsset = {
  id: number
  filename: string
  source_type: string
  building_id: number | null
  floor_id: number | null
  status: string
  message: string | null
  created_at: string | null
}

export type UploadAssetCreate = {
  filename: string
  source_type: 'dxf' | 'image' | 'ifc' | 'glb' | 'pointcloud' | 'unknown'
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
    body: formData,
  })
  if (!response.ok) {
    throw new Error(`Upload failed with ${response.status}`)
  }
  return response.json() as Promise<UploadAsset>
}
