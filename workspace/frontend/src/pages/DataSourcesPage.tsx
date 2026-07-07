import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from './PageHeader'
import { listBuildings } from '../api/buildings'
import type { Building } from '../api/buildings'
import { listFloors, createFloor } from '../api/floors'
import type { Floor } from '../api/floors'
import { listUploadsByBuilding, uploadFile } from '../api/uploads'
import type { UploadAsset } from '../api/uploads'

const SOURCE_TYPES = [
  { value: 'dxf', label: 'DXF 도면' },
  { value: 'image', label: '이미지 (PNG/JPG)' },
  { value: 'ifc', label: 'IFC 모델' },
  { value: 'glb', label: 'GLB 3D' },
] as const

export function DataSourcesPage() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | ''>('')
  const [floors, setFloors] = useState<Floor[]>([])
  const [uploads, setUploads] = useState<UploadAsset[]>([])
  const [uploading, setUploading] = useState(false)

  // File upload form
  const [file, setFile] = useState<File | null>(null)
  const [sourceType, setSourceType] = useState<string>('dxf')
  const [newFloorNumber, setNewFloorNumber] = useState('')
  const [creatingFloor, setCreatingFloor] = useState(false)

  const loadBuildings = useCallback(async () => {
    try {
      const data = await listBuildings()
      setBuildings(data)
    } catch {
      // silently fail
    }
  }, [])

  const loadFloors = useCallback(async (buildingId: number) => {
    try {
      const data = await listFloors(buildingId)
      setFloors(data)
    } catch {
      setFloors([])
    }
  }, [])

  const loadUploads = useCallback(async (buildingId: number) => {
    try {
      const data = await listUploadsByBuilding(buildingId)
      setUploads(data)
    } catch {
      setUploads([])
    }
  }, [])

  useEffect(() => {
    loadBuildings()
  }, [loadBuildings])

  useEffect(() => {
    if (selectedBuildingId !== '') {
      loadFloors(selectedBuildingId)
      loadUploads(selectedBuildingId)
    } else {
      setFloors([])
      setUploads([])
    }
  }, [selectedBuildingId, loadFloors, loadUploads])

  const handleBuildingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSelectedBuildingId(val ? Number(val) : '')
  }

  const handleAddFloor = async () => {
    if (selectedBuildingId === '' || !newFloorNumber.trim()) return
    setCreatingFloor(true)
    try {
      await createFloor(selectedBuildingId, {
        floor_number: parseInt(newFloorNumber, 10),
      })
      setNewFloorNumber('')
      await loadFloors(selectedBuildingId)
    } catch {
      // silently fail
    } finally {
      setCreatingFloor(false)
    }
  }

  const handleUpload = async () => {
    if (selectedBuildingId === '' || !file) return
    setUploading(true)
    try {
      await uploadFile(file, sourceType, selectedBuildingId)
      setFile(null)
      // Reset file input
      const input = document.getElementById('file-input') as HTMLInputElement
      if (input) input.value = ''
      await loadUploads(selectedBuildingId)
    } catch {
      // silently fail
    } finally {
      setUploading(false)
    }
  }

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId)

  return (
    <section className="page-grid">
      <PageHeader
        eyebrow="Step 2"
        title="Data Sources"
        description="건물을 선택하고 DXF/이미지 도면을 업로드합니다."
      />

      {/* Building Selector */}
      <div className="card">
        <strong>건물 선택</strong>
        <div className="form-row">
          <select
            className="select-input"
            value={selectedBuildingId}
            onChange={handleBuildingChange}
          >
            <option value="">-- 건물 선택 --</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedBuildingId !== '' && (
        <>
          {/* Floors */}
          <div className="card">
            <strong>층 목록</strong>
            {floors.length === 0 ? (
              <p className="hint">등록된 층이 없습니다. 아래에서 추가해주세요.</p>
            ) : (
              <div className="chip-list">
                {floors.map((f) => (
                  <span key={f.id} className="chip">
                    {f.floor_name ?? `${f.floor_number}층`}
                    {f.input_type && <small> ({f.input_type})</small>}
                  </span>
                ))}
              </div>
            )}
            <div className="form-row-inline">
              <input
                type="number"
                className="text-input narrow"
                placeholder="층 번호 (예: 1)"
                value={newFloorNumber}
                onChange={(e) => setNewFloorNumber(e.target.value)}
              />
              <button className="btn btn-secondary" onClick={handleAddFloor} disabled={creatingFloor}>
                {creatingFloor ? '추가 중...' : '층 추가'}
              </button>
            </div>
          </div>

          {/* Upload Form */}
          <div className="card">
            <strong>파일 업로드</strong>
            <div className="form-row">
              <select
                className="select-input"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <input
                id="file-input"
                type="file"
                className="file-input"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <button className="btn btn-primary" onClick={handleUpload} disabled={uploading || !file}>
              {uploading ? '업로드 중...' : '업로드'}
            </button>
          </div>

          {/* Upload List */}
          <div className="card">
            <strong>업로드 내역 ({uploads.length})</strong>
            {uploads.length === 0 ? (
              <p className="hint">아직 업로드된 파일이 없습니다.</p>
            ) : (
              <div className="upload-list">
                {uploads.map((u) => (
                  <div key={u.id} className="upload-row">
                    <div className="upload-info">
                      <span className="upload-filename">{u.filename}</span>
                      <span className="upload-meta">
                        {SOURCE_TYPES.find((t) => t.value === u.source_type)?.label ?? u.source_type}
                        {' · '}
                        {u.status}
                      </span>
                    </div>
                    {u.message && <span className="upload-msg">{u.message}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
