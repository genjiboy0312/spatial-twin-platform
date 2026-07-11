import { useEffect } from 'react'
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

export function useProjectSelectionSync<T extends { id: number }>(
  buildings: T[],
  selectedBuildingId: number | null,
  setSelectedBuildingId: (buildingId: number | null) => void,
) {
  const globalSelectedBuildingId = useProjectStore((state) => state.selectedBuildingId)
  const setGlobalSelectedBuildingId = useProjectStore((state) => state.setSelectedBuildingId)

  useEffect(() => {
    if (buildings.length === 0) {
      if (selectedBuildingId !== null) setSelectedBuildingId(null)
      if (globalSelectedBuildingId !== null) setGlobalSelectedBuildingId(null)
      return
    }

    const hasGlobal = globalSelectedBuildingId !== null && buildings.some((building) => building.id === globalSelectedBuildingId)
    const hasLocal = selectedBuildingId !== null && buildings.some((building) => building.id === selectedBuildingId)
    const next = hasGlobal ? globalSelectedBuildingId : hasLocal ? selectedBuildingId : buildings[0]!.id

    if (selectedBuildingId !== next) setSelectedBuildingId(next)
    if (globalSelectedBuildingId !== next) setGlobalSelectedBuildingId(next)
  }, [buildings, globalSelectedBuildingId, selectedBuildingId, setGlobalSelectedBuildingId, setSelectedBuildingId])
}
