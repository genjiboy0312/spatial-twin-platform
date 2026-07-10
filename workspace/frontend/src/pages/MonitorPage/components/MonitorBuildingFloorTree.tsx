import type { Building } from '../../../api/buildings'
import type { Floor } from '../../../api/floors'
import { Building2 } from '../monitorIcons'

export interface MonitorBuildingFloorTreeProps {
  buildings: Building[]
  floors: Floor[]
  selectedBuildingId: number | null
  selectedFloorId: number | null
  labels: {
    buildingFloors: string
    floors: string
  }
  onBuildingSelect: (id: number) => void
  onFloorSelect: (id: number) => void
}

export function MonitorBuildingFloorTree({
  buildings,
  floors,
  selectedBuildingId,
  selectedFloorId,
  labels,
  onBuildingSelect,
  onFloorSelect,
}: MonitorBuildingFloorTreeProps) {
  if (buildings.length === 0) {
    return <div className="monitor-panel-empty">No projects available.</div>
  }

  return (
    <>
      <div className="monitor-panel-title">
        <span>{labels.buildingFloors}</span>
        <strong>{buildings.length}</strong>
      </div>

      <div className="monitor-building-list">
        {buildings.map((building) => (
          <button
            key={building.id}
            type="button"
            className={building.id === selectedBuildingId ? 'active' : ''}
            onClick={() => onBuildingSelect(building.id)}
          >
            <span>
              <Building2 size={14} strokeWidth={1.6} />
              {building.name}
            </span>
            <small>{building.total_floors ?? floors.length} {labels.floors}</small>
          </button>
        ))}
      </div>

      {floors.length > 0 && (
        <>
          <div className="monitor-panel-title compact">
            <span>Floors</span>
            <strong>{floors.length}</strong>
          </div>
          <div className="monitor-floor-list">
            {floors.map((floor) => (
              <button
                key={floor.id}
                type="button"
                className={floor.id === selectedFloorId ? 'active' : ''}
                onClick={() => onFloorSelect(floor.id)}
              >
                <span>{floor.floor_name ?? `${floor.floor_number}F`}</span>
                <small>#{floor.id}</small>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
