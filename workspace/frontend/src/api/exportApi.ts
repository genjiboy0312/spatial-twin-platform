import { exportToDxf, type ExportSceneData } from '../utils/exportUtils'

const DXF_EXPORT_ENDPOINT = 'http://localhost:8003/export/dxf'

export type DxfExportSource = 'backend' | 'client'

export type DxfExportResult = {
  content: string
  source: DxfExportSource
}

export async function exportToBackendDxf(data: ExportSceneData): Promise<Blob> {
  let response: Response

  try {
    response = await fetch(DXF_EXPORT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown network error'
    throw new Error(`Backend DXF export request failed: ${message}`)
  }

  if (!response.ok) {
    throw new Error(`Backend DXF export failed with ${response.status}`)
  }

  return response.blob()
}

export async function exportDxfWithFallback(data: ExportSceneData): Promise<DxfExportResult> {
  try {
    const blob = await exportToBackendDxf(data)
    return { content: await blob.text(), source: 'backend' }
  } catch {
    return { content: exportToDxf(data.walls, data.rooms, data.devices), source: 'client' }
  }
}
