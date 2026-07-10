import { create } from 'zustand'

const SELECTED_BUILDING_KEY = 'spatial_selected_building_id'

type ProjectState = {
  selectedBuildingId: number | null
  setSelectedBuildingId: (buildingId: number | null) => void
}

function readSelectedBuildingId(): number | null {
  const value = localStorage.getItem(SELECTED_BUILDING_KEY)
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function writeSelectedBuildingId(buildingId: number | null) {
  if (buildingId === null) {
    localStorage.removeItem(SELECTED_BUILDING_KEY)
    return
  }
  localStorage.setItem(SELECTED_BUILDING_KEY, String(buildingId))
}

export function preferredBuildingId<T extends { id: number }>(
  buildings: T[],
  current: number | null | '',
): number | null {
  if (typeof current === 'number' && buildings.some((building) => building.id === current)) return current
  const stored = readSelectedBuildingId()
  if (stored && buildings.some((building) => building.id === stored)) return stored
  return buildings[0]?.id ?? null
}

export const useProjectStore = create<ProjectState>((set) => ({
  selectedBuildingId: readSelectedBuildingId(),
  setSelectedBuildingId: (buildingId) => {
    writeSelectedBuildingId(buildingId)
    set({ selectedBuildingId: buildingId })
  },
}))
