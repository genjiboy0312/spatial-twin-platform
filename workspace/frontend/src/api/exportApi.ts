import { authHeaders } from './client'
import { exportToDxf, type ExportSceneData } from '../utils/exportUtils'

const EXPORT_ENDPOINT = '/api/exports'

export type DxfExportSource = 'backend' | 'client'

export type DxfExportResult = {
  content: string
  source: DxfExportSource
}

export async function exportToBackendDxf(data: ExportSceneData): Promise<Blob> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
  let response: Response

  try {
    response = await fetch(`${baseUrl}${EXPORT_ENDPOINT}/dxf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
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

export async function exportPackage(data: ExportSceneData): Promise<Blob> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
  const response = await fetch(`${baseUrl}${EXPORT_ENDPOINT}/package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error(`Project package export failed with ${response.status}`)
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
