import { useMemo, useState } from 'react'

import type { SecurityDevice } from '../../../stores/editorStore'
import { Bell, Camera, Fingerprint, Monitor, Radio, Search, Wifi } from '../monitorIcons'

export interface MonitorDevicePanelProps {
  devices: SecurityDevice[]
  selectedDeviceId: string | null
  labels: {
    all: string
    search: string
    deviceLabels: Record<string, string>
    noMatch: string
    emptyDevices: string
    online: string
  }
  onSelect: (id: string) => void
}

type NormalizedDeviceType = 'camera' | 'sensor' | 'access' | 'alarm' | 'other'

const DEVICE_TYPE_CONFIG: Record<NormalizedDeviceType, { icon: typeof Camera; color: string }> = {
  camera: { icon: Camera, color: '#86efac' },
  sensor: { icon: Radio, color: '#7dd3fc' },
  access: { icon: Fingerprint, color: '#fde68a' },
  alarm: { icon: Bell, color: '#fca5a5' },
  other: { icon: Monitor, color: 'var(--muted)' },
}

const FILTER_TYPES: Array<{ key: NormalizedDeviceType; labelKey: string }> = [
  { key: 'camera', labelKey: 'camera' },
  { key: 'sensor', labelKey: 'sensor' },
  { key: 'access', labelKey: 'access' },
  { key: 'alarm', labelKey: 'alarm' },
]

function normalizeType(type: string): NormalizedDeviceType {
  const normalized = type.toLowerCase()
  if (normalized.includes('camera') || normalized.includes('cctv')) return 'camera'
  if (normalized.includes('sensor')) return 'sensor'
  if (normalized.includes('access')) return 'access'
  if (normalized.includes('alarm')) return 'alarm'
  return 'other'
}

export function MonitorDevicePanel({ devices, selectedDeviceId, labels, onSelect }: MonitorDevicePanelProps) {
  const [activeFilter, setActiveFilter] = useState<NormalizedDeviceType | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredDevices = useMemo(() => {
    let list = devices
    if (activeFilter !== null) {
      list = list.filter((device) => normalizeType(device.device_type as string) === activeFilter)
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      list = list.filter((device) => device.name.toLowerCase().includes(query))
    }
    return list
  }, [activeFilter, devices, searchQuery])

  return (
    <div className="monitor-device-panel">
      <div className="monitor-panel-title">
        <span>Security Devices</span>
        <strong>{devices.length}</strong>
      </div>

      <div className="monitor-device-search">
        <label>
          <Search size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={labels.search}
          />
        </label>
      </div>

      <div className="monitor-device-filters">
        <button type="button" className={activeFilter === null ? 'active' : ''} onClick={() => setActiveFilter(null)}>
          {labels.all}
        </button>
        {FILTER_TYPES.map(({ key, labelKey }) => {
          const active = activeFilter === key
          const config = DEVICE_TYPE_CONFIG[key]
          const Icon = config.icon

          return (
            <button
              key={key}
              type="button"
              className={active ? 'active' : ''}
              style={{ color: active ? config.color : undefined }}
              onClick={() => setActiveFilter(active ? null : key)}
            >
              <Icon size={11} />
              {labels.deviceLabels[labelKey] ?? labelKey}
            </button>
          )
        })}
      </div>

      <div className="monitor-device-list">
        {filteredDevices.length === 0 ? (
          <div className="monitor-panel-empty">
            <Search size={20} strokeWidth={1.5} />
            <p>{searchQuery ? labels.noMatch : labels.emptyDevices}</p>
          </div>
        ) : (
          filteredDevices.map((device) => {
            const normalizedType = normalizeType(device.device_type as string)
            const config = DEVICE_TYPE_CONFIG[normalizedType]
            const DeviceIcon = config.icon
            const selected = selectedDeviceId === device.id

            return (
              <button key={device.id} type="button" className={selected ? 'selected' : ''} onClick={() => onSelect(device.id)}>
                <span className="monitor-device-icon" style={{ color: config.color }}>
                  <DeviceIcon size={15} />
                </span>
                <span>
                  <strong>{device.name}</strong>
                  <small>
                    <Wifi size={10} />
                    {labels.deviceLabels[device.device_type as string] ?? device.device_type}
                    <span> · {device.x.toFixed(1)}, {device.y.toFixed(1)}</span>
                  </small>
                </span>
                <i>{labels.online}</i>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
