import { useCallback, useEffect, useState } from 'react'
import { listBuildings, type Building } from '../../../api/buildings'
import { listFloors, type Floor } from '../../../api/floors'
import { useEditorStore, type SecurityDevice } from '../../../stores/editorStore'
import { preferredBuildingId, useProjectStore } from '../../../stores/projectStore'

export interface MonitorDataState {
  buildings: Building[]
  floors: Floor[]
  selectedBuildingId: number | null
  selectedFloorId: number | null
  selectedBuilding: Building | null
  selectedFloor: Floor | null
  devices: SecurityDevice[]
  cameras: SecurityDevice[]
  setSelectedBuildingId: (id: number | null) => void
  setSelectedFloorId: (id: number | null) => void
  reloadBuildings: () => void
}

export function useMonitorData(): MonitorDataState {
  const editorDevices = useEditorStore((state) => state.devices)
  const setGlobalSelectedBuildingId = useProjectStore((state) => state.setSelectedBuildingId)
  const fallbackDevices = useEditorStore((state) => state.devices)
  const devices = editorDevices.length > 0 ? editorDevices : fallbackDevices

  const [buildings, setBuildings] = useState<Building[]>([])
  const [floors, setFloors] = useState<Floor[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null)

  const loadBuildings = useCallback(async () => {
    try {
      const data = await listBuildings()
      setBuildings(data)
      setSelectedBuildingId((current) => {
        const next = preferredBuildingId(data, current)
        setGlobalSelectedBuildingId(next)
        return next
      })
    } catch {
      setBuildings([])
      setSelectedBuildingId(null)
    }
  }, [setGlobalSelectedBuildingId])

  const handleSelectedBuildingId = useCallback((id: number | null) => {
    setSelectedBuildingId(id)
    setGlobalSelectedBuildingId(id)
  }, [setGlobalSelectedBuildingId])

  useEffect(() => {
    loadBuildings()
  }, [loadBuildings])

  useEffect(() => {
    if (selectedBuildingId === null) {
      setFloors([])
      setSelectedFloorId(null)
      return
    }
    listFloors(selectedBuildingId)
      .then((next) => {
        setFloors(next)
        setSelectedFloorId((current) => {
          if (current && next.some((f) => f.id === current)) return current
          return next[0]?.id ?? null
        })
      })
      .catch(() => {
        setFloors([])
        setSelectedFloorId(null)
      })
  }, [selectedBuildingId])

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId) ?? null
  const selectedFloor = floors.find((f) => f.id === selectedFloorId) ?? null
  const cameras = devices.filter((d) => d.device_type === 'camera')

  return {
    buildings,
    floors,
    selectedBuildingId,
    selectedFloorId,
    selectedBuilding,
    selectedFloor,
    devices,
    cameras,
    setSelectedBuildingId: handleSelectedBuildingId,
    setSelectedFloorId,
    reloadBuildings: loadBuildings,
  }
}
