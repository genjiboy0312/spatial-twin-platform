import type { ObjectPlacement } from '../api/projectData'
import type { SecurityDevice, SecurityDeviceType } from '../stores/editorStore'

export type FloorScopedSecurityDevice = SecurityDevice & {
  floor_id: number | null
}

const securityDeviceTypes: SecurityDeviceType[] = ['camera', 'sensor', 'alarm', 'access']

function isSecurityDeviceType(value: unknown): value is SecurityDeviceType {
  return typeof value === 'string' && securityDeviceTypes.includes(value as SecurityDeviceType)
}

export function deviceFromObjectPlacement(placement: ObjectPlacement): FloorScopedSecurityDevice | null {
  const metadata = placement.metadata ?? {}
  if (metadata.editor_source !== 'editor-device') return null
  if (!isSecurityDeviceType(metadata.device_type)) return null

  return {
    id: typeof metadata.editor_id === 'string' ? metadata.editor_id : `placement-${placement.id}`,
    name: placement.name,
    device_type: metadata.device_type,
    x: placement.position_x,
    y: placement.position_z,
    angle: placement.rotation_y,
    floor_id: placement.floor_id,
  }
}
