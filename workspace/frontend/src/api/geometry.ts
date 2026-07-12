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
}

export type FloorGeometry = {
  floor_id: number
  walls: WallGeometry[]
  rooms: RoomGeometry[]
}

export function getFloorGeometry(floorId: number): Promise<FloorGeometry> {
  return getJson<FloorGeometry>(`/api/floors/${floorId}/geometry`)
}

export function syncFloorGeometry(
  floorId: number,
  payload: { walls: WallGeometry[]; rooms: RoomGeometry[] },
): Promise<FloorGeometry> {
  return sendJson<FloorGeometry, { walls: WallGeometry[]; rooms: RoomGeometry[] }>(
    `/api/floors/${floorId}/geometry`,
    'PUT',
    payload,
  )
}
