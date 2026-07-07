import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from './PageHeader'
import { listBuildings } from '../api/buildings'
import type { Building } from '../api/buildings'
import { listFloors } from '../api/floors'
import type { Floor } from '../api/floors'
import { Canvas2DViewer, type Wall2D } from '../components/Canvas2DViewer'
import { ThreeJSViewer } from '../components/ThreeJSViewer'
import { DrawingToolbar } from '../components/DrawingToolbar'
import { PropertyPanel } from '../components/PropertyPanel'
import { useEditorStore } from '../stores/editorStore'

type ViewMode = '2d' | '3d'

export function EditorPage() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | ''>('')
  const [floors, setFloors] = useState<Floor[]>([])
  const [selectedFloor, setSelectedFloor] = useState<number | ''>('')
  const [viewMode, setViewMode] = useState<ViewMode>('2d')

  // Editor store
  const mode = useEditorStore((s) => s.mode)
  const walls = useEditorStore((s) => s.walls)
  const rooms = useEditorStore((s) => s.rooms)
  const selectedWallIdx = useEditorStore((s) => s.selectedWallIdx)
  const selectedRoomIdx = useEditorStore((s) => s.selectedRoomIdx)
  const visibleLayers = useEditorStore((s) => s.visibleLayers)
  const setMode = useEditorStore((s) => s.setMode)
  const addWall = useEditorStore((s) => s.addWall)
  const selectWall = useEditorStore((s) => s.selectWall)
  const selectRoom = useEditorStore((s) => s.selectRoom)
  const deleteWallAt = useEditorStore((s) => s.deleteWallAt)
  const loadSample = useEditorStore((s) => s.loadSample)
  const moveWall = useEditorStore((s) => s.moveWall)
  const pushHistory = useEditorStore((s) => s.pushHistory)
  const snapPoint = useEditorStore((s) => s.snapPoint)

  const loadBuildings = useCallback(async () => {
    try {
      setBuildings(await listBuildings())
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

  useEffect(() => { loadBuildings() }, [loadBuildings])

  useEffect(() => {
    if (selectedBuildingId !== '') {
      loadFloors(selectedBuildingId)
      setSelectedFloor('')
    } else {
      setFloors([])
      setSelectedFloor('')
    }
  }, [selectedBuildingId, loadFloors])

  // Auto-load sample data once on mount
  const [initialized, setInitialized] = useState(false)
  useEffect(() => {
    if (!initialized) {
      loadSample()
      setInitialized(true)
    }
  }, [initialized, loadSample])

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId)
  let selectedWall: Wall2D | null = null
  if (selectedWallIdx != null && selectedWallIdx < walls.length) {
    selectedWall = walls[selectedWallIdx] as Wall2D
  }

  return (
    <section className="page-grid editor-layout">
      <PageHeader
        eyebrow="Step 3 / 4"
        title="2D / 3D Editor"
        description="건물과 층을 선택하고 2D 또는 3D로 도면을 확인하거나 편집합니다."
      />

      {/* Building / Floor toolbar */}
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

      {/* Drawing toolbar (2D only) */}
      <div className="full-width">
        <DrawingToolbar
          mode={mode}
          onChange={setMode}
          onLoadSample={loadSample}
          onClear={useEditorStore.getState().clearAll}
          wallCount={walls.length}
        />
      </div>

      {/* Viewport */}
      <div className="viewer-container full-width">
        {viewMode === '2d' ? (
          <Canvas2DViewer
            walls={walls}
            rooms={rooms}
            selectedWallIdx={selectedWallIdx}
            selectedRoomIdx={selectedRoomIdx}
            visibleLayers={visibleLayers}
            editMode={mode}
            width={760}
            height={480}
            onSelectWall={(idx) => {
              if (idx >= 0) selectWall(idx); else selectWall(-1)
            }}
            onSelectRoom={(idx) => {
              if (idx >= 0) selectRoom(idx); else selectRoom(-1)
            }}
            onDrawWall={(x1, y1, x2, y2) => addWall(x1, y1, x2, y2)}
            onDeleteAt={(wx, wy) => deleteWallAt(wx, wy)}
            onMoveWall={(idx, dx, dy) => moveWall(idx, dx, dy)}
            onFinishMoveWall={(idx, x1, y1, x2, y2) => {
              pushHistory()
            }}
            snapPoint={(x, y) => snapPoint(x, y)}
          />
        ) : (
          <ThreeJSViewer />
        )}
      </div>

      {/* Property Panel */}
      <PropertyPanel
        selectedWall={selectedWall}
        wallIndex={selectedWallIdx}
        wallCount={walls.length}
        roomCount={rooms.length}
        rooms={rooms}
        selectedRoomIdx={selectedRoomIdx}
      />
    </section>
  )
}
