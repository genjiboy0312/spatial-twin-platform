import { useCallback, useEffect, useState } from 'react'
import { listBuildings, type Building } from '../../../api/buildings'
import { listFloors, type Floor } from '../../../api/floors'
import { listObjectPlacements, type ObjectPlacement } from '../../../api/projectData'
import { useEditorStore, type SecurityDevice } from '../../../stores/editorStore'
import { preferredBuildingId, useProjectSelectionSync, useProjectStore } from '../../../stores/projectStore'
import { deviceFromObjectPlacement, type FloorScopedSecurityDevice } from '../../../utils/projectObjectPlacements'

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

  const [buildings, setBuildings] = useState<Building[]>([])
  const [floors, setFloors] = useState<Floor[]>([])
  const [placementDevices, setPlacementDevices] = useState<FloorScopedSecurityDevice[]>([])
  const [placementsLoaded, setPlacementsLoaded] = useState(false)
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null)
  useProjectSelectionSync(buildings, selectedBuildingId, setSelectedBuildingId)

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
      setPlacementDevices([])
      setPlacementsLoaded(false)
      setSelectedFloorId(null)
      return
    }
    setPlacementsLoaded(false)
    Promise.all([
      listFloors(selectedBuildingId),
      listObjectPlacements(selectedBuildingId).catch(() => [] as ObjectPlacement[]),
    ])
      .then(([nextFloors, placements]) => {
        setFloors(nextFloors)
        setPlacementDevices(
          placements
            .map(deviceFromObjectPlacement)
            .filter((device): device is FloorScopedSecurityDevice => device !== null),
        )
        setPlacementsLoaded(true)
        setSelectedFloorId((current) => {
          if (current && nextFloors.some((f) => f.id === current)) return current
          return nextFloors[0]?.id ?? null
        })
      })
      .catch(() => {
        setFloors([])
        setPlacementDevices([])
        setPlacementsLoaded(true)
        setSelectedFloorId(null)
      })
  }, [selectedBuildingId])

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId) ?? null
  const selectedFloor = floors.find((f) => f.id === selectedFloorId) ?? null
  const floorScopedDevices = placementDevices.filter((device) => (
    selectedFloorId === null ? device.floor_id === null : device.floor_id === selectedFloorId
  ))
  const devices: SecurityDevice[] = placementsLoaded
    ? floorScopedDevices.map(({ floor_id: _floorId, ...device }) => device)
    : editorDevices
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
