import type { SecurityDeviceType } from '../stores/editorStore'

export const DEVICE_TYPE_LABELS: Record<SecurityDeviceType, string> = {
  camera: '카메라',
  sensor: '센서',
  alarm: '알람',
  access: '출입',
}

export const DEVICE_TYPE_EN_LABELS: Record<SecurityDeviceType, string> = {
  camera: 'Camera',
  sensor: 'Sensor',
  alarm: 'Alarm',
  access: 'Access',
}

export const DEVICE_ICONS: Record<SecurityDeviceType, string> = {
  camera: 'CAM',
  sensor: 'SNS',
  alarm: 'ALM',
  access: 'ACS',
}

export const DEVICE_COLORS: Record<SecurityDeviceType, string> = {
  camera: '#38bdf8',
  sensor: '#22c55e',
  alarm: '#ef4444',
  access: '#facc15',
}

export const DEVICE_TYPE_LIST: SecurityDeviceType[] = ['camera', 'sensor', 'alarm', 'access']

export interface DevicePreset {
  type: SecurityDeviceType
  name: string
  icon: string
  color: string
  defaultLabel: string
}

export const DEVICE_PRESETS: DevicePreset[] = DEVICE_TYPE_LIST.map((type) => ({
  type,
  name: DEVICE_TYPE_LABELS[type],
  icon: DEVICE_ICONS[type],
  color: DEVICE_COLORS[type],
  defaultLabel: DEVICE_TYPE_LABELS[type],
}))
