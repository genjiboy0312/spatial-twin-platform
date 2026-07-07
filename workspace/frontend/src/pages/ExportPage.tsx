import { useMemo, useState } from 'react'
import { PageHeader } from './PageHeader'
import type { Wall2D, Room2D } from '../components/Canvas2DViewer'
import { exportDxfWithFallback } from '../api/exportApi'
import { useEditorStore, type SecurityDevice } from '../stores/editorStore'
import { downloadBlob, exportToCsv, exportToObj, exportToPdf } from '../utils/exportUtils'

type ExportFormat = 'obj' | 'dxf' | 'csv' | 'pdf'

type PreviewBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const PREVIEW_WIDTH = 760
const PREVIEW_HEIGHT = 320
const PREVIEW_PADDING = 28

const FORMAT_CARDS: { format: ExportFormat; title: string; description: string; extension: string }[] = [
  { format: 'obj', title: 'OBJ', description: '3D floor, wall quads, and device crosses for modeling tools.', extension: '.obj' },
  { format: 'dxf', title: 'DXF', description: 'CAD linework with WALLS, ROOMS, and DEVICES layers.', extension: '.dxf' },
  { format: 'csv', title: 'CSV', description: 'Device inventory with coordinates and room labels.', extension: '.csv' },
  { format: 'pdf', title: 'PDF', description: 'Open the browser print dialog for print-to-PDF output.', extension: 'print' },
]

function formatTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

function getRoomBounds(room: Room2D): PreviewBounds {
  return {
    minX: Math.min(room.x, room.x + room.w),
    minY: Math.min(room.y, room.y + room.h),
    maxX: Math.max(room.x, room.x + room.w),
    maxY: Math.max(room.y, room.y + room.h),
  }
}

function getPreviewBounds(walls: Wall2D[], rooms: Room2D[], devices: SecurityDevice[]): PreviewBounds {
  const bounds: PreviewBounds[] = [
    ...rooms.map(getRoomBounds),
    ...walls.map((wall) => ({
      minX: Math.min(wall.x1, wall.x2),
      minY: Math.min(wall.y1, wall.y2),
      maxX: Math.max(wall.x1, wall.x2),
      maxY: Math.max(wall.y1, wall.y2),
    })),
    ...devices.map((device) => ({
      minX: device.x,
      minY: device.y,
      maxX: device.x,
      maxY: device.y,
    })),
  ]

  if (bounds.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 }

  return bounds.reduce(
    (acc, bound) => ({
      minX: Math.min(acc.minX, bound.minX),
      minY: Math.min(acc.minY, bound.minY),
      maxX: Math.max(acc.maxX, bound.maxX),
      maxY: Math.max(acc.maxY, bound.maxY),
    }),
    bounds[0]!,
  )
}

export function ExportPage() {
  const walls = useEditorStore((s) => s.walls)
  const rooms = useEditorStore((s) => s.rooms)
  const devices = useEditorStore((s) => s.devices)
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('obj')
  const [status, setStatus] = useState('Choose a format and export the current editor scene.')
  const [isExporting, setIsExporting] = useState(false)

  const bounds = useMemo(() => getPreviewBounds(walls, rooms, devices), [walls, rooms, devices])
  const hasScene = walls.length > 0 || rooms.length > 0 || devices.length > 0
  const sceneWidth = Math.max(bounds.maxX - bounds.minX, 1)
  const sceneHeight = Math.max(bounds.maxY - bounds.minY, 1)
  const previewScale = Math.min(
    (PREVIEW_WIDTH - PREVIEW_PADDING * 2) / sceneWidth,
    (PREVIEW_HEIGHT - PREVIEW_PADDING * 2) / sceneHeight,
  )
  const toPreviewX = (x: number) => PREVIEW_PADDING + (x - bounds.minX) * previewScale
  const toPreviewY = (y: number) => PREVIEW_PADDING + (y - bounds.minY) * previewScale

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const filenameBase = `spatial-twin-export-${formatTimestamp()}`

      if (selectedFormat === 'obj') {
        downloadBlob(exportToObj(walls, rooms, devices), `${filenameBase}.obj`, 'text/plain')
        setStatus('Downloaded OBJ successfully.')
      } else if (selectedFormat === 'dxf') {
        const result = await exportDxfWithFallback({ walls, rooms, devices })
        downloadBlob(result.content, `${filenameBase}.dxf`, 'application/dxf')
        setStatus(
          result.source === 'backend'
            ? 'Downloaded DXF successfully from backend export.'
            : 'Downloaded DXF successfully using client-side fallback.',
        )
      } else if (selectedFormat === 'csv') {
        downloadBlob(exportToCsv(devices, rooms), `${filenameBase}.csv`, 'text/csv')
        setStatus('Downloaded CSV successfully.')
      } else {
        exportToPdf().print()
        setStatus('Print dialog triggered for PDF export.')
      }
    } catch (error) {
      setStatus(error instanceof Error ? `Export failed: ${error.message}` : 'Export failed.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <section className="page-grid editor-layout" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <PageHeader
        eyebrow="Export"
        title="Export"
        description="Export the current walls, rooms, and security devices for CAD, modeling, reporting, or print workflows."
      />

      <div className="full-width viewer-container" style={{ minWidth: PREVIEW_WIDTH }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ color: '#eef2ff', fontSize: 14, fontWeight: 700 }}>2D Export Preview</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Mini overview of the scene that will be exported.</div>
          </div>
          <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right' }}>
            {walls.length} walls · {rooms.length} rooms · {devices.length} devices
          </div>
        </div>

        <svg
          aria-label="Export preview floor plan"
          role="img"
          viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}
          style={{
            background: '#0b1220',
            border: '1px solid rgba(148, 163, 184, 0.18)',
            borderRadius: 16,
            display: 'block',
            height: PREVIEW_HEIGHT,
            width: PREVIEW_WIDTH,
          }}
        >
          {hasScene ? (
            <>
              {rooms.map((room, index) => {
                const roomBounds = getRoomBounds(room)
                return (
                  <g key={`${room.label ?? 'room'}-${index}`}>
                    <rect
                      x={toPreviewX(roomBounds.minX)}
                      y={toPreviewY(roomBounds.minY)}
                      width={(roomBounds.maxX - roomBounds.minX) * previewScale}
                      height={(roomBounds.maxY - roomBounds.minY) * previewScale}
                      fill="rgba(59, 130, 246, 0.16)"
                      stroke="rgba(96, 165, 250, 0.7)"
                      strokeWidth="1.5"
                    />
                    {room.label && (
                      <text
                        x={toPreviewX(roomBounds.minX) + 8}
                        y={toPreviewY(roomBounds.minY) + 18}
                        fill="#bfdbfe"
                        fontSize="11"
                        fontWeight="700"
                      >
                        {room.label}
                      </text>
                    )}
                  </g>
                )
              })}
              {walls.map((wall, index) => (
                <line
                  key={`${wall.x1}-${wall.y1}-${wall.x2}-${wall.y2}-${index}`}
                  x1={toPreviewX(wall.x1)}
                  y1={toPreviewY(wall.y1)}
                  x2={toPreviewX(wall.x2)}
                  y2={toPreviewY(wall.y2)}
                  stroke="#e2e8f0"
                  strokeLinecap="round"
                  strokeWidth="4"
                />
              ))}
              {devices.map((device) => {
                const x = toPreviewX(device.x)
                const y = toPreviewY(device.y)
                return (
                  <g key={device.id}>
                    <line x1={x - 5} y1={y} x2={x + 5} y2={y} stroke="#fbbf24" strokeWidth="2" />
                    <line x1={x} y1={y - 5} x2={x} y2={y + 5} stroke="#fbbf24" strokeWidth="2" />
                    <circle cx={x} cy={y} r="3" fill="#f59e0b" />
                  </g>
                )
              })}
            </>
          ) : (
            <text x="50%" y="50%" dominantBaseline="middle" fill="#64748b" fontSize="14" textAnchor="middle">
              No editor geometry to preview yet
            </text>
          )}
        </svg>
      </div>

      <div
        className="full-width"
        style={{
          background: '#0b1220',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: 16,
          padding: 18,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>Select export format</h2>
            <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
              DXF tries the backend exporter first, then falls back to the client-side exporter if the service is unavailable.
            </p>
          </div>
          <button className="btn btn-primary" disabled={isExporting} onClick={handleExport} type="button">
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginBottom: 14 }}>
          {FORMAT_CARDS.map((card) => {
            const isSelected = selectedFormat === card.format
            return (
              <button
                key={card.format}
                type="button"
                onClick={() => setSelectedFormat(card.format)}
                style={{
                  background: isSelected ? 'rgba(59, 130, 246, 0.18)' : 'rgba(15, 23, 42, 0.78)',
                  border: `1px solid ${isSelected ? '#38bdf8' : 'rgba(148, 163, 184, 0.14)'}`,
                  borderRadius: 14,
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  minHeight: 150,
                  padding: 16,
                  textAlign: 'left',
                }}
              >
                <span style={{ color: '#38bdf8', display: 'block', fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                  {card.extension}
                </span>
                <span style={{ color: '#f8fafc', display: 'block', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
                  {card.title}
                </span>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: 12, lineHeight: 1.5 }}>
                  {card.description}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ color: '#94a3b8', fontSize: 13 }}>{status}</div>
      </div>
    </section>
  )
}
