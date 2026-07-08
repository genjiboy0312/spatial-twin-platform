import type { ComponentType, DragEvent } from 'react'
import type { SecurityDevice, SecurityDeviceType } from '../../stores/editorStore'
import { DEVICE_PRESETS } from '../../constants/devices'
import { DeviceListItem } from './DeviceListItem'
import { Bell, Camera, DoorOpen, List as ListIcon, Plus, Radio, RefreshCw } from '../Icons'

interface Props {
  devices: SecurityDevice[]
  selectedDeviceIdx: number | null
  deviceType: SecurityDeviceType
  onDeviceTypeChange: (type: SecurityDeviceType) => void
  onSelectDevice: (idx: number | null) => void
  onRemoveDevice: (idx: number) => void
  onStartAddDevice?: () => void
  onRefresh?: () => void
}

const DEVICE_ICON_MAP: Record<SecurityDeviceType, ComponentType<{ size?: number }>> = {
  camera: Camera,
  sensor: Radio,
  alarm: Bell,
  access: DoorOpen,
}

export function EnhancedDevicePanel({
  devices,
  selectedDeviceIdx,
  deviceType,
  onDeviceTypeChange,
  onSelectDevice,
  onRemoveDevice,
  onStartAddDevice,
  onRefresh,
}: Props) {
  const handleDragStart = (event: DragEvent, type: SecurityDeviceType) => {
    event.dataTransfer.setData('application/device-type', type)
    event.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="enhanced-device-panel">
      <div className="device-panel-header">
        <span className="device-section-label">보안장치</span>
        {onRefresh && (
          <button className="device-header-refresh" type="button" onClick={onRefresh} title="새로고침">
            <RefreshCw size={14} />
          </button>
        )}
      </div>

      {onStartAddDevice && (
        <button
          className="device-add-btn"
          type="button"
          onClick={onStartAddDevice}
          title="캔버스에 장치 배치"
        >
          <Plus size={14} />
          <span>보안장치 추가</span>
        </button>
      )}

      <div className="device-type-selector">
        {DEVICE_PRESETS.map((preset) => {
          const Icon = DEVICE_ICON_MAP[preset.type]
          const isActive = deviceType === preset.type
          return (
            <button
              key={preset.type}
              className={'device-type-btn-outlined' + (isActive ? ' active' : '')}
              type="button"
              draggable
              onDragStart={(event) => handleDragStart(event, preset.type)}
              onClick={() => onDeviceTypeChange(preset.type)}
              title={preset.name}
            >
              <Icon size={18} />
              <span className="device-type-name">{preset.name}</span>
            </button>
          )
        })}
      </div>

      <div className="device-list-section">
        <div className="device-list-header">
          <ListIcon size={14} />
          <span className="eyebrow-muted">배치된 장치</span>
          <span className="device-list-count">{devices.length}</span>
        </div>
        {devices.length === 0 ? (
          <p className="device-list-empty">
            배치된 장치가 없습니다.
            <br />
            <small>위 버튼을 눌러 장치를 추가한 뒤 캔버스를 클릭해 배치하세요.</small>
          </p>
        ) : (
          <div className="device-list">
            {devices.map((device, idx) => (
              <DeviceListItem
                key={device.id}
                device={device}
                index={idx}
                selected={idx === selectedDeviceIdx}
                onSelect={() => onSelectDevice(idx === selectedDeviceIdx ? null : idx)}
                onRemove={() => onRemoveDevice(idx)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
