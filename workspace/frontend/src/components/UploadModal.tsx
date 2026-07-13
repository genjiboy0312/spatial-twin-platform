import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'

import type { Building } from '../api/buildings'
import type { Floor } from '../api/floors'
import { uploadFile, uploadModelPackage } from '../api/uploads'
import { Modal } from './Modal'

type UploadType = 'dxf' | 'image' | 'ifc' | 'glb' | 'pointcloud'
type ModelPackageSlots = { gltf: string | null; glb: string | null; bin: string[]; textures: string[] }
type UploadToast = { tone: 'error' | 'success'; message: string }

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
    description: 'CAD 도면과 벽체 선형을 현재 층에 연결합니다.',
    accept: '.dxf,.dwg',
    guide: ['외부 참조(XREF)가 있다면 바인딩 또는 DXF 변환 후 업로드하세요.', '단위 스케일은 데이터 소스 페이지에서 mm/cm/m 기준으로 저장됩니다.'],
  },
  {
    type: 'image',
    icon: 'IMG',
    title: '이미지',
    description: 'PNG, JPG 도면 이미지를 현재 층 배경으로 연결합니다.',
    accept: '.png,.jpg,.jpeg',
    guide: ['선명하고 수평에 가까운 평면 이미지를 권장합니다.', '업로드 후 에디터에서 축척과 위치를 확인하세요.'],
  },
  {
    type: 'ifc',
    icon: 'IFC',
    title: 'IFC 파일',
    description: 'BIM 모델에서 공간과 벽체 정보를 가져옵니다.',
    accept: '.ifc',
    guide: ['IFC 층 정보가 선택한 층과 맞는지 확인하세요.', '대용량 모델은 처리 시간이 길어질 수 있습니다.'],
  },
  {
    type: 'glb',
    icon: 'GLB',
    title: 'GLB / GLTF',
    description: '3D 시각화를 위한 모델 패키지를 연결합니다.',
    accept: '.glb,.gltf,.bin,.png,.jpg,.jpeg,.webp',
    guide: ['GLB는 단일 파일로 업로드할 수 있습니다.', 'GLTF는 .gltf, .bin, 텍스처 파일을 함께 선택하거나 폴더로 추가하세요.'],
  },
  {
    type: 'pointcloud',
    icon: 'PCD',
    title: 'PointCloud',
    description: 'LAS, LAZ, PLY 포인트클라우드를 현재 층에 연결합니다.',
    accept: '.las,.laz,.ply',
    guide: ['PointCloud 업로드는 기존 동작을 유지합니다.', '업로드 후 PointCloud 페이지에서 렌더링 상태를 확인하세요.'],
  },
]

function typeLabel(type: UploadType) {
  if (type === 'pointcloud') return 'PointCloud'
  if (type === 'glb') return 'GLB / GLTF'
  if (type === 'dxf') return 'DXF / DWG'
  return type.toUpperCase()
}

function uploadSourceTypeForFile(type: UploadType, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (type === 'dxf' && extension === 'dwg') return 'dwg'
  if (type === 'glb') return 'glb'
  return type
}

function fileDebugInfo(file: File) {
  return {
    name: file.name,
    size: file.size,
    type: file.type || '(empty)',
    lastModified: file.lastModified,
  }
}

function emptyModelSlots(): ModelPackageSlots {
  return { gltf: null, glb: null, bin: [], textures: [] }
}

function isTextureFile(name: string) {
  return /\.(png|jpg|jpeg|webp)$/i.test(name)
}

function isModelPackageFile(name: string) {
  const lower = name.toLowerCase()
  return lower.endsWith('.glb') || lower.endsWith('.gltf') || lower.endsWith('.bin') || isTextureFile(lower)
}

function dedupeModelFiles(files: File[]) {
  const byName = new Map<string, File>()
  files.forEach((item) => {
    const key = item.name.toLowerCase()
    if (byName.has(key)) byName.delete(key)
    byName.set(key, item)
  })
  return Array.from(byName.values())
}

function buildModelSlots(files: File[]): ModelPackageSlots {
  const slots = emptyModelSlots()
  files.forEach((item) => {
    const lower = item.name.toLowerCase()
    if (lower.endsWith('.glb')) slots.glb = item.name
    else if (lower.endsWith('.gltf')) slots.gltf = item.name
    else if (lower.endsWith('.bin')) slots.bin.push(item.name)
    else if (isTextureFile(lower)) slots.textures.push(item.name)
  })
  return slots
}

function stageModelFiles(current: File[], incoming: File[]) {
  const accepted = dedupeModelFiles(incoming.filter((item) => isModelPackageFile(item.name)))
  if (accepted.length === 0) return current
  const glbFiles = accepted.filter((item) => item.name.toLowerCase().endsWith('.glb'))
  if (glbFiles.length > 0) return [glbFiles[glbFiles.length - 1]!]
  return dedupeModelFiles([...current.filter((item) => !item.name.toLowerCase().endsWith('.glb')), ...accepted])
}

export function UploadModal({ isOpen, onClose, buildings, floors, selectedBuildingId, selectedFloorId, onUploaded }: Props) {
  const [selectedType, setSelectedType] = useState<UploadType | null>(null)
  const [buildingId, setBuildingId] = useState<number | ''>(selectedBuildingId)
  const [floorId, setFloorId] = useState<number | ''>(selectedFloorId)
  const [file, setFile] = useState<File | null>(null)
  const [modelFiles, setModelFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<UploadToast | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setBuildingId(selectedBuildingId)
    setFloorId(selectedFloorId)
    setSelectedType(null)
    setFile(null)
    setModelFiles([])
    setSuccess(null)
    setError(null)
    setToast(null)
  }, [isOpen, selectedBuildingId, selectedFloorId])

  useEffect(() => {
    if (!toast) return undefined
    const timeoutId = window.setTimeout(() => setToast(null), toast.tone === 'error' ? 8000 : 4000)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const filteredFloors = floors.filter((floor) => buildingId !== '' && floor.building_id === buildingId)
  const selectedOption = uploadOptions.find((option) => option.type === selectedType)
  const modelSlots = useMemo(() => buildModelSlots(modelFiles), [modelFiles])
  const modelIsGltfMode = !modelSlots.glb && (modelSlots.gltf !== null || modelSlots.bin.length > 0 || modelSlots.textures.length > 0)
  const modelReady = Boolean(modelSlots.glb || (modelSlots.gltf && modelSlots.bin.length > 0 && modelSlots.textures.length > 0))

  const resetSelection = () => {
    console.log('[UploadModal] resetSelection', { selectedType })
    setFile(null)
    setModelFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (folderInputRef.current) folderInputRef.current.value = ''
  }

  const showError = (message: string) => {
    console.error('[UploadModal] visible error', message)
    setError(message)
    setToast({ tone: 'error', message })
  }

  const clearMessages = () => {
    setError(null)
    setSuccess(null)
    setToast(null)
  }

  const handleTypeSelect = (type: UploadType) => {
    console.log('[UploadModal] upload type selected', { type })
    setSelectedType(type)
    resetSelection()
    clearMessages()
  }

  const openFileDialog = () => {
    console.log('[UploadModal] file chooser button clicked', {
      selectedType,
      inputReady: Boolean(fileInputRef.current),
      accept: selectedOption?.accept,
    })
    fileInputRef.current?.click()
  }

  const openFolderDialog = () => {
    console.log('[UploadModal] folder chooser button clicked', {
      selectedType,
      inputReady: Boolean(folderInputRef.current),
    })
    folderInputRef.current?.click()
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    console.log('[UploadModal] handleFileChange fired', {
      selectedType,
      inputName: event.target.name || '(unnamed)',
      fileCount: selectedFiles.length,
      files: selectedFiles.map(fileDebugInfo),
    })
    clearMessages()
    if (selectedType === 'glb') {
      setModelFiles((current) => {
        const nextFiles = stageModelFiles(current, selectedFiles)
        console.log('[UploadModal] model files state update queued', {
          previousCount: current.length,
          selectedCount: selectedFiles.length,
          nextCount: nextFiles.length,
          files: nextFiles.map(fileDebugInfo),
        })
        return nextFiles
      })
      event.target.value = ''
      return
    }
    const nextFile = selectedFiles[0] ?? null
    console.log('[UploadModal] file state update queued', nextFile ? fileDebugInfo(nextFile) : null)
    setFile(nextFile)
    event.target.value = ''
  }

  const handleSubmit = async () => {
    console.log('[UploadModal] handleSubmit started', {
      selectedType,
      buildingId,
      floorId,
      submitting,
      hasFile: Boolean(file),
      file: file ? fileDebugInfo(file) : null,
      modelReady,
      modelFileCount: modelFiles.length,
    })
    if (!selectedType) {
      console.warn('[UploadModal] validation failed: missing upload type')
      showError('업로드 형식을 먼저 선택하세요.')
      return
    }
    if (buildingId === '') {
      console.warn('[UploadModal] validation failed: missing building')
      showError('건물을 선택하세요.')
      return
    }
    if (selectedType === 'glb' && !modelReady) {
      console.warn('[UploadModal] validation failed: model package incomplete', { modelFiles: modelFiles.map(fileDebugInfo), modelSlots })
      showError('GLB 단일 파일 또는 GLTF + BIN + Texture 파일을 함께 선택하세요.')
      return
    }
    if (selectedType !== 'glb' && !file) {
      console.warn('[UploadModal] validation failed: missing file', { selectedType })
      showError('파일 선택 버튼을 눌러 업로드할 파일을 선택하세요.')
      return
    }

    console.log('[UploadModal] validation passed; starting upload', {
      selectedType,
      buildingId,
      floorId: floorId === '' ? undefined : floorId,
      file: file ? fileDebugInfo(file) : null,
      modelFiles: modelFiles.map(fileDebugInfo),
    })

    setSubmitting(true)
    clearMessages()

    try {
      if (selectedType === 'glb') {
        console.log('[UploadModal] calling uploadModelPackage', {
          fileCount: modelFiles.length,
          buildingId,
          floorId: floorId === '' ? undefined : floorId,
        })
        await uploadModelPackage(modelFiles, buildingId, floorId === '' ? undefined : floorId)
      } else if (file) {
        const sourceType = uploadSourceTypeForFile(selectedType, file)
        console.log('[UploadModal] calling uploadFile', {
          sourceType,
          buildingId,
          floorId: floorId === '' ? undefined : floorId,
          file: fileDebugInfo(file),
        })
        await uploadFile(file, sourceType, buildingId, floorId === '' ? undefined : floorId)
      }
      await onUploaded?.()
      const successMessage = `${selectedType === 'glb' ? '모델 패키지' : file?.name} 업로드가 완료되었습니다.`
      console.log('[UploadModal] upload completed', { selectedType, message: successMessage })
      setSuccess(successMessage)
      setToast({ tone: 'success', message: successMessage })
      window.setTimeout(onClose, 900)
    } catch (err) {
      const message = err instanceof Error ? err.message : '업로드에 실패했습니다.'
      console.error('[UploadModal] upload failed', err)
      showError(message)
    } finally {
      setSubmitting(false)
      console.log('[UploadModal] handleSubmit finished')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="도면 / 모델 파일 업로드">
      <div className="editor-popup">
        {toast && (
          <div className={`editor-upload-toast ${toast.tone}`} role="alert" aria-live="assertive">
            <strong>{toast.tone === 'error' ? '업로드 오류' : '업로드 알림'}</strong>
            <span>{toast.message}</span>
            <button type="button" aria-label="알림 닫기" onClick={() => setToast(null)}>
              ×
            </button>
          </div>
        )}
        {error && (
          <div className="editor-popup-alert error prominent" role="alert" aria-live="assertive">
            <strong>업로드 오류</strong>
            <span>{error}</span>
          </div>
        )}
        {success && <div className="editor-popup-alert success">{success}</div>}

        {!selectedType ? (
          <div className="editor-upload-type-grid">
            {uploadOptions.map((option) => (
              <button key={option.type} className="editor-upload-type-card" type="button" onClick={() => handleTypeSelect(option.type)}>
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
                  resetSelection()
                  clearMessages()
                }}
              >
                형식 변경
              </button>
            </div>

            <div className="editor-popup-field-grid">
              <label>
                <span>건물</span>
                <select
                  value={buildingId}
                  onChange={(event) => {
                    setBuildingId(event.target.value === '' ? '' : Number(event.target.value))
                    clearMessages()
                  }}
                >
                  <option value="">-- 건물 선택 --</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>층</span>
                <select
                  value={floorId}
                  onChange={(event) => {
                    setFloorId(event.target.value === '' ? '' : Number(event.target.value))
                    clearMessages()
                  }}
                >
                  <option value="">-- 층 선택 --</option>
                  {filteredFloors.map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {floor.floor_name || `${floor.floor_number}층`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="editor-upload-drop-panel">
              <span className="editor-upload-drop-icon">{selectedOption?.icon}</span>
              <h3>{selectedOption?.title} 업로드</h3>
              <p>{selectedOption?.description}</p>
              <p className="editor-upload-format">지원 형식: {selectedOption?.accept.replaceAll('.', '').toUpperCase()}</p>
              <input ref={fileInputRef} type="file" accept={selectedOption?.accept} multiple={selectedType === 'glb'} onChange={handleFileChange} hidden />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                onChange={handleFileChange}
                hidden
              />

              {selectedType === 'glb' ? (
                <div className="editor-model-package">
                  {modelFiles.length > 0 && (
                    <div className="editor-model-file-list">
                      {modelFiles.map((modelFile, index) => (
                        <span key={`${modelFile.name}-${index}`} title={modelFile.name}>
                          {modelFile.name}
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => setModelFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                            aria-label={`${modelFile.name} 제거`}
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {(modelIsGltfMode || modelFiles.length > 0) && (
                    <div className="editor-model-slots">
                      <span className={modelSlots.glb || modelSlots.gltf ? 'filled' : ''}>GLB/GLTF</span>
                      <span className={modelSlots.glb || modelSlots.bin.length > 0 ? 'filled' : ''}>BIN</span>
                      <span className={modelSlots.glb || modelSlots.textures.length > 0 ? 'filled' : ''}>Texture</span>
                    </div>
                  )}
                  <div className="editor-popup-actions compact">
                    <button className="btn btn-secondary" type="button" disabled={submitting} onClick={openFileDialog}>
                      파일 추가
                    </button>
                    <button className="btn btn-secondary" type="button" disabled={submitting} onClick={openFolderDialog}>
                      폴더 추가
                    </button>
                    <button className="btn btn-secondary" type="button" disabled={submitting || modelFiles.length === 0} onClick={resetSelection}>
                      초기화
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="editor-popup-actions compact">
                    <button className="btn btn-secondary" type="button" disabled={submitting} onClick={openFileDialog}>
                      파일 선택
                    </button>
                    <button className="btn btn-secondary" type="button" disabled={submitting || !file} onClick={resetSelection}>
                      초기화
                    </button>
                  </div>
                  {file && <strong className="editor-selected-file">{file.name}</strong>}
                </>
              )}
            </div>

            {selectedOption && (
              <div className="editor-popup-guide">
                <strong>업로드 안내</strong>
                <ul>
                  {selectedOption.guide.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose} disabled={submitting} type="button">
                취소
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting} type="button">
                {submitting ? '업로드 중...' : '업로드 시작'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
