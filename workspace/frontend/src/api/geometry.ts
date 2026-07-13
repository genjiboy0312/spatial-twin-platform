import { getJson, sendJson } from './client'

export type WallGeometry = {
  id?: number
  floor_id?: number
  x1: number
  y1: number
  x2: number
  y2: number
}

export type RoomGeometry = {
  id?: number
  floor_id?: number
  name: string
  x: number
  y: number
  w: number
  h: number
  points?: Array<{ x: number; y: number }> | null
}

export type DoorGeometry = {
  id?: number
  floor_id?: number
  x: number
  y: number
  width: number
  rotation_degrees: number
  door_type?: string
}

export type WindowGeometry = {
  id?: number
  floor_id?: number
  x: number
  y: number
  width: number
  rotation_degrees: number
  window_type?: string
  sill_height_meters?: number
}

export type FloorGeometry = {
  floor_id: number
  walls: WallGeometry[]
  rooms: RoomGeometry[]
  doors?: DoorGeometry[]
  windows?: WindowGeometry[]
}

export function getFloorGeometry(floorId: number): Promise<FloorGeometry> {
  return getJson<FloorGeometry>(`/api/floors/${floorId}/geometry`)
}

export function syncFloorGeometry(
  floorId: number,
  payload: { walls: WallGeometry[]; rooms: RoomGeometry[]; doors?: DoorGeometry[]; windows?: WindowGeometry[] },
): Promise<FloorGeometry> {
  return sendJson<FloorGeometry, { walls: WallGeometry[]; rooms: RoomGeometry[]; doors?: DoorGeometry[]; windows?: WindowGeometry[] }>(
    `/api/floors/${floorId}/geometry`,
    'PUT',
    payload,
  )
}
