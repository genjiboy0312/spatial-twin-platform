import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'
import { uploadFile } from '../api/uploads'
import type { Building } from '../api/buildings'
import type { Floor } from '../api/floors'

type UploadType = 'dxf' | 'image' | 'ifc' | 'glb' | 'pointcloud'

type Props = {
  isOpen: boolean
  onClose: () => void
  buildings: Building[]
  floors: Floor[]
  selectedBuildingId: number | ''
  selectedFloorId: number | ''
  onUploaded?: () => void | Promise<void>
}

const uploadOptions: Array<{
  type: UploadType
  icon: string
  title: string
  description: string
  accept: string
  guide: string[]
}> = [
  {
    type: 'dxf',
    icon: 'DXF',
    title: 'DXF / DWG 파일',
    description: 'CAD 도면을 벽체와 평면 소스로 업로드합니다.',
    accept: '.dxf,.dwg',
    guide: ['도면 단위가 mm/cm/m 중 무엇인지 확인하세요.', '벽체 라인이 닫혀 있으면 후속 검증이 더 정확합니다.'],
  },
  {
    type: 'image',
    icon: 'IMG',
    title: '이미지',
    description: 'PNG, JPG 평면 이미지를 현재 층 배경으로 연결합니다.',
    accept: '.png,.jpg,.jpeg',
    guide: ['평면이 선명하고 수평에 가까운 이미지를 권장합니다.', '업로드 후 에디터에서 스케일과 위치를 확인하세요.'],
  },
  {
    type: 'ifc',
    icon: 'IFC',
    title: 'IFC 파일',
    description: 'BIM 모델에서 공간/벽체 정보를 가져옵니다.',
    accept: '.ifc',
    guide: ['IFC 층 정보가 현재 선택한 층과 맞는지 확인하세요.', '대용량 모델은 처리 시간이 길 수 있습니다.'],
  },
  {
    type: 'glb',
    icon: 'GLB',
    title: 'GLB / GLTF',
    description: '3D 시각화를 위한 모델 파일을 연결합니다.',
    accept: '.glb,.gltf,.bin,.png,.jpg,.jpeg',
    guide: ['GLTF는 .bin 및 텍스처 파일과 함께 관리하세요.', '현재 팝업에서는 대표 파일 1개를 먼저 업로드합니다.'],
  },
  {
    type: 'pointcloud',
    icon: 'PCD',
    title: 'PointCloud',
    description: 'LAS, LAZ, PLY 포인트클라우드를 현재 층에 연결합니다.',
    accept: '.las,.laz,.ply',
    guide: ['좌표계와 층 기준이 맞는 파일을 권장합니다.', '업로드 후 PointCloud 페이지에서 연결 상태를 확인하세요.'],
  },
]

function typeLabel(type: UploadType) {
  if (type === 'pointcloud') return 'PointCloud'
  if (type === 'glb') return 'GLB / GLTF'
  if (type === 'dxf') return 'DXF / DWG'
  return type.toUpperCase()
}

export function UploadModal({ isOpen, onClose, buildings, floors, selectedBuildingId, selectedFloorId, onUploaded }: Props) {
  const [selectedType, setSelectedType] = useState<UploadType | null>(null)
  const [buildingId, setBuildingId] = useState<number | ''>(selectedBuildingId)
  const [floorId, setFloorId] = useState<number | ''>(selectedFloorId)
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setBuildingId(selectedBuildingId)
    setFloorId(selectedFloorId)
    setSelectedType(null)
    setFile(null)
    setSuccess(null)
    setError(null)
  }, [isOpen, selectedBuildingId, selectedFloorId])

  const filteredFloors = floors.filter((floor) => buildingId !== '' && floor.building_id === buildingId)
  const selectedOption = uploadOptions.find((option) => option.type === selectedType)

  const handleSubmit = async () => {
    if (!selectedType) {
      setError('업로드 형식을 먼저 선택하세요.')
      return
    }
    if (!file) {
      setError('파일 선택 버튼을 눌러 업로드할 파일을 선택하세요.')
      return
    }
    if (buildingId === '') {
      setError('건물을 선택하세요.')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      await uploadFile(file, selectedType, buildingId, floorId === '' ? undefined : floorId)
      await onUploaded?.()
      setSuccess(`${file.name} 업로드가 완료되었습니다.`)
      window.setTimeout(onClose, 900)
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="도면 / 모델 파일 업로드">
      <div className="editor-popup">
        {error && <div className="editor-popup-alert error">{error}</div>}
        {success && <div className="editor-popup-alert success">{success}</div>}

        {!selectedType ? (
          <div className="editor-upload-type-grid">
            {uploadOptions.map((option) => (
              <button
                key={option.type}
                className="editor-upload-type-card"
                type="button"
                onClick={() => setSelectedType(option.type)}
              >
                <span>{option.icon}</span>
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="editor-upload-detail">
            <div className="editor-popup-toolbar">
              <div>
                <span className="eyebrow-muted">선택된 업로드 형식</span>
                <strong>{typeLabel(selectedType)}</strong>
              </div>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={submitting}
                onClick={() => {
                  setSelectedType(null)
                  setFile(null)
                }}
              >
                형식 변경
              </button>
            </div>

            <div className="editor-popup-field-grid">
              <label>
                <span>건물</span>
                <select value={buildingId} onChange={(event) => setBuildingId(event.target.value === '' ? '' : Number(event.target.value))}>
                  <option value="">-- 건물 선택 --</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>{building.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>층</span>
                <select value={floorId} onChange={(event) => setFloorId(event.target.value === '' ? '' : Number(event.target.value))}>
                  <option value="">-- 층 선택 --</option>
                  {filteredFloors.map((floor) => (
                    <option key={floor.id} value={floor.id}>{floor.floor_name || `${floor.floor_number}층`}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="editor-upload-drop-panel">
              <span className="editor-upload-drop-icon">{selectedOption?.icon}</span>
              <h3>{selectedOption?.title} 업로드</h3>
              <p>{selectedOption?.description}</p>
              <p className="editor-upload-format">지원 형식: {selectedOption?.accept.replaceAll('.', '').toUpperCase()}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept={selectedOption?.accept}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                hidden
              />
              <div className="editor-popup-actions compact">
                <button className="btn btn-secondary" type="button" disabled={submitting} onClick={() => fileInputRef.current?.click()}>
                  파일 선택
                </button>
                <button className="btn btn-secondary" type="button" disabled={submitting || !file} onClick={() => setFile(null)}>
                  초기화
                </button>
              </div>
              {file && <strong className="editor-selected-file">{file.name}</strong>}
            </div>

            {selectedOption && (
              <div className="editor-popup-guide">
                <strong>업로드 안내</strong>
                <ul>
                  {selectedOption.guide.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose} disabled={submitting} type="button">취소</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !file} type="button">
                {submitting ? '업로드 중...' : '업로드 시작'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
