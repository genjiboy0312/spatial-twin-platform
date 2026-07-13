import { authHeaders, getJson, sendJson } from './client'

export type Floor = {
  id: number
  building_id: number
  floor_number: number
  floor_name: string | null
  height_meters: number
  input_type: string | null
}

export type FloorCreate = {
  floor_number: number
  floor_name?: string
  height_meters?: number
  input_type?: string
}

export function listFloors(buildingId: number): Promise<Floor[]> {
  return getJson<Floor[]>(`/api/buildings/${buildingId}/floors`)
}

export function createFloor(buildingId: number, payload: FloorCreate): Promise<Floor> {
  return sendJson<Floor, FloorCreate>(`/api/buildings/${buildingId}/floors`, 'POST', payload)
}

export async function deleteFloor(floorId: number): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
  const response = await fetch(`${baseUrl}/api/floors/${floorId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!response.ok) {
    throw new Error(`Delete floor failed with ${response.status}`)
  }
}
