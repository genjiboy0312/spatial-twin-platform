import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Wall2D, Room2D } from '../components/Canvas2DViewer'
import type { SecurityDevice } from '../stores/editorStore'
import { downloadBlob, exportToCsv, exportToDxf, exportToObj } from './exportUtils'

type MockAnchor = {
  href: string
  download: string
  style: { display: string }
  click: () => void
}

const walls: Wall2D[] = [{ x1: 0, y1: 0, x2: 4, y2: 0 }]
const rooms: Room2D[] = [{ x: 0, y: 0, w: 4, h: 3, label: 'Lobby' }]
const devices: SecurityDevice[] = [
  { id: 'cam-1', x: 1, y: 1, device_type: 'camera', name: 'Entry Camera', angle: 90 },
]

describe('export utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('exports OBJ vertices and faces', () => {
    const obj = exportToObj(walls, rooms, devices)
    const vertexLines = obj.split('\n').filter((line) => line.startsWith('v '))
    const faceLines = obj.split('\n').filter((line) => line.startsWith('f '))

    expect(vertexLines).toHaveLength(20)
    expect(faceLines).toHaveLength(9)
    expect(obj).toContain('# Walls: 1')
  })

  it('exports CSV header and device data', () => {
    const csv = exportToCsv(devices, rooms)

    expect(csv).toContain('id,name,device_type,x,y,angle,room_label')
    expect(csv).toContain('cam-1,Entry Camera,camera,1,1,90,Lobby')
  })

  it('neutralizes spreadsheet formulas in CSV text cells', () => {
    const formulaDevice: SecurityDevice = {
      id: 'sensor-1',
      x: 2,
      y: 2,
      device_type: 'sensor',
      name: '=HYPERLINK("http://example.test")',
    }
    const csv = exportToCsv([formulaDevice], [{ x: 0, y: 0, w: 4, h: 3, label: '@Lab' }])

    expect(csv).toContain('sensor-1,"\'=HYPERLINK(""http://example.test"")",sensor,2,2,,\'@Lab')
  })

  it('exports DXF section and entity markers', () => {
    const dxf = exportToDxf(walls, rooms, devices)

    expect(dxf).toContain('SECTION')
    expect(dxf).toContain('$ACADVER')
    expect(dxf).toContain('AC1009')
    expect(dxf).toContain('ENTITIES')
    expect(dxf).toContain('WALLS')
    expect(dxf).toContain('ROOMS')
    expect(dxf).toContain('DEVICE_CAMERA')
    expect(dxf).toContain('CIRCLE')
    expect(dxf).toContain('EOF')
  })

  it('downloads content with object URL cleanup', () => {
    const createObjectURL = vi.fn(() => 'blob:export')
    const revokeObjectURL = vi.fn()
    const click = vi.fn()
    const anchor: MockAnchor = {
      href: '',
      download: '',
      style: { display: '' },
      click,
    }
    const appendChild = vi.fn()
    const removeChild = vi.fn()
    const documentMock = {
      createElement: vi.fn(() => anchor as unknown as HTMLAnchorElement),
      body: { appendChild, removeChild },
    } as unknown as Document

    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.stubGlobal('document', documentMock)

    downloadBlob('export content', 'scene.obj', 'text/plain')

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(anchor.href).toBe('blob:export')
    expect(anchor.download).toBe('scene.obj')
    expect(appendChild).toHaveBeenCalledWith(anchor)
    expect(click).toHaveBeenCalledTimes(1)
    expect(removeChild).toHaveBeenCalledWith(anchor)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export')
  })
})
