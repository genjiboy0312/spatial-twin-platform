import { useMemo, useState } from 'react'
import { Modal } from './Modal'
import { exportDxfWithFallback } from '../api/exportApi'
import { useEditorStore } from '../stores/editorStore'
import { downloadBlob, exportToCsv, exportToObj, exportToPdf } from '../utils/exportUtils'

type ExportFormat = 'obj' | 'dxf' | 'csv' | 'pdf'

type Props = {
  isOpen: boolean
  onClose: () => void
  buildingName?: string | undefined
  floorName?: string | undefined
}

const exportOptions: Array<{
  format: ExportFormat
  icon: string
  title: string
  description: string
  filename: string
}> = [
  { format: 'obj', icon: 'OBJ', title: 'OBJ + Metadata', description: '현재 에디터 씬을 3D 모델 교환 형식으로 내보냅니다.', filename: 'spatial-twin-scene.obj' },
  { format: 'dxf', icon: 'DXF', title: 'DXF CAD', description: '벽체, 방, 장치 정보를 CAD 도면 형식으로 내보냅니다.', filename: 'spatial-twin-scene.dxf' },
  { format: 'csv', icon: 'CSV', title: 'Device CSV', description: '배치된 보안 장치 목록과 좌표를 CSV로 내보냅니다.', filename: 'spatial-twin-devices.csv' },
  { format: 'pdf', icon: 'PDF', title: 'PDF / Print', description: '현재 화면을 인쇄 또는 PDF 저장 흐름으로 보냅니다.', filename: 'spatial-twin-report.pdf' },
]

export function ExportModal({ isOpen, onClose, buildingName = 'Spatial Twin', floorName = 'Current floor' }: Props) {
  const [format, setFormat] = useState<ExportFormat | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { walls, rooms, devices } = useEditorStore()

  const summary = useMemo(() => [
    { label: 'Walls', value: walls.length },
    { label: 'Rooms', value: rooms.length },
    { label: 'Devices', value: devices.length },
    { label: 'Floor', value: floorName },
  ], [devices.length, floorName, rooms.length, walls.length])

  const selectedOption = exportOptions.find((option) => option.format === format)

  const handleExport = async () => {
    if (!format) {
      setError('내보내기 형식을 선택하세요.')
      return
    }

    setSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      if (format === 'obj') {
        downloadBlob(exportToObj(walls, rooms, devices), selectedOption?.filename ?? 'scene.obj', 'text/plain;charset=utf-8')
        setMessage('OBJ 파일 다운로드를 시작했습니다.')
      } else if (format === 'dxf') {
        const result = await exportDxfWithFallback({ walls, rooms, devices })
        downloadBlob(result.content, selectedOption?.filename ?? 'scene.dxf', 'application/dxf;charset=utf-8')
        setMessage(result.source === 'backend' ? 'DXF 파일 다운로드를 시작했습니다.' : 'DXF 서버가 없어 클라이언트 내보내기로 다운로드했습니다.')
      } else if (format === 'csv') {
        downloadBlob(exportToCsv(devices, rooms), selectedOption?.filename ?? 'devices.csv', 'text/csv;charset=utf-8')
        setMessage('장치 CSV 다운로드를 시작했습니다.')
      } else if (format === 'pdf') {
        exportToPdf().print()
        setMessage('브라우저 인쇄/PDF 저장 창을 열었습니다.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '내보내기에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="데이터 내보내기">
      <div className="editor-popup">
        {error && <div className="editor-popup-alert error">{error}</div>}
        {message && <div className="editor-popup-alert success">{message}</div>}

        {!format ? (
          <div className="editor-export-type-grid">
            {exportOptions.map((option) => (
              <button
                key={option.format}
                className="editor-export-type-card"
                type="button"
                onClick={() => setFormat(option.format)}
              >
                <span>{option.icon}</span>
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="editor-export-detail">
            <div className="editor-popup-toolbar">
              <div>
                <span className="eyebrow-muted">선택된 내보내기 형식</span>
                <strong>{selectedOption?.title}</strong>
              </div>
              <button className="btn btn-secondary" type="button" disabled={submitting} onClick={() => setFormat(null)}>
                형식 변경
              </button>
            </div>

            <div className="editor-export-summary">
              <div className="editor-export-summary-title">
                <span>Export target</span>
                <strong>{buildingName}</strong>
              </div>
              <div className="editor-export-stat-grid">
                {summary.map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="editor-popup-guide">
              <strong>내보내기 안내</strong>
              <ul>
                <li>현재 에디터 메모리에 있는 벽체, 방, 장치 데이터 기준으로 생성됩니다.</li>
                <li>DXF는 서버 내보내기가 실패하면 클라이언트 DXF 생성으로 자동 대체됩니다.</li>
                <li>PDF는 브라우저의 인쇄/저장 기능을 사용합니다.</li>
              </ul>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose} disabled={submitting} type="button">닫기</button>
              <button className="btn btn-primary" onClick={handleExport} disabled={submitting} type="button">
                {submitting ? '내보내는 중...' : '내보내기 시작'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
