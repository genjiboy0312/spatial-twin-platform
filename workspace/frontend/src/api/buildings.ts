import { getJson, sendJson } from './client'

export type Building = {
  id: number
  name: string
  address: string | null
  total_floors: number
  origin_longitude: number | null
  origin_latitude: number | null
}

export type BuildingCreate = {
  name: string
  address?: string
  total_floors?: number
  origin_longitude?: number
  origin_latitude?: number
}

export function listBuildings(): Promise<Building[]> {
  return getJson<Building[]>('/api/buildings')
}

export function createBuilding(payload: BuildingCreate): Promise<Building> {
  return sendJson<Building, BuildingCreate>('/api/buildings', 'POST', payload)
}
