import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from './PageHeader'
import { listBuildings } from '../api/buildings'
import type { Building } from '../api/buildings'
import { listFloors } from '../api/floors'
import type { Floor } from '../api/floors'
import { Canvas2DViewer } from '../components/Canvas2DViewer'
import { ThreeJSViewer } from '../components/ThreeJSViewer'

type ViewMode = '2d' | '3d'

export function EditorPage() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | ''>('')
  const [floors, setFloors] = useState<Floor[]>([])
  const [selectedFloor, setSelectedFloor] = useState<number | ''>('')
  const [viewMode, setViewMode] = useState<ViewMode>('2d')

  const loadBuildings = useCallback(async () => {
    try {
      const data = await listBuildings()
      setBuildings(data)
    } catch {
      /* ignore */
    }
  }, [])

  const loadFloors = useCallback(async (buildingId: number) => {
    try {
      const data = await listFloors(buildingId)
      setFloors(data)
      const first = data[0]
      if (first) setSelectedFloor(first.floor_number)
    } catch {
      setFloors([])
    }
  }, [])

  useEffect(() => {
    loadBuildings()
  }, [loadBuildings])

  useEffect(() => {
    if (selectedBuildingId !== '') {
      loadFloors(selectedBuildingId)
      setSelectedFloor('')
    } else {
      setFloors([])
      setSelectedFloor('')
    }
  }, [selectedBuildingId, loadFloors])

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId)

  return (
    <section className="page-grid editor-layout">
      <PageHeader
        eyebrow="Step 3"
        title="2D / 3D Editor"
        description="건물과 층을 선택하고 2D 또는 3D로 도면을 확인합니다."
      />

      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          <select
            className="select-input"
            value={selectedBuildingId}
            onChange={(e) => setSelectedBuildingId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">-- 건물 선택 --</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {floors.length > 0 && (
            <select
              className="select-input narrow"
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value ? Number(e.target.value) : '')}
            >
              {floors.map((f) => (
                <option key={f.id} value={f.floor_number}>
                  {f.floor_name ?? `${f.floor_number}층`}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="editor-toolbar-right">
          <button
            className={`btn ${viewMode === '2d' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('2d')}
          >
            2D
          </button>
          <button
            className={`btn ${viewMode === '3d' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('3d')}
          >
            3D
          </button>
        </div>
      </div>

      {/* Viewport */}
      {selectedBuildingId === '' ? (
        <div className="viewer-placeholder full-width">
          <span>건물과 층을 선택하면 도면이 표시됩니다</span>
        </div>
      ) : viewMode === '2d' ? (
        <div className="viewer-container full-width">
          <Canvas2DViewer width={760} height={480} />
        </div>
      ) : (
        <div className="viewer-container full-width">
          <ThreeJSViewer />
        </div>
      )}

      {/* Property Panel */}
      <aside className="inspector card">
        <strong>Properties</strong>
        {selectedBuilding ? (
          <div className="inspector-info">
            <p><span>Building</span> {selectedBuilding.name}</p>
            {selectedFloor !== '' && <p><span>Floor</span> {selectedFloor}층</p>}
            {selectedBuilding.origin_latitude != null && selectedBuilding.origin_longitude != null && (
              <p>
                <span>Origin</span>
                {selectedBuilding.origin_latitude.toFixed(4)}, {selectedBuilding.origin_longitude.toFixed(4)}
              </p>
            )}
          </div>
        ) : (
          <p className="hint">건물을 선택하면 속성이 표시됩니다.</p>
        )}
      </aside>
    </section>
  )
}
