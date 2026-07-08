import { Camera, Radio, Bell, DoorOpen } from '../Icons'
import type { SecurityDevice } from '../../stores/editorStore'
import { DEVICE_TYPE_LABELS, DEVICE_COLORS } from '../../constants/devices'

const DEVICE_ICON_MAP = {
  camera: Camera,
  sensor: Radio,
  alarm: Bell,
  access: DoorOpen,
}

interface Props {
  device: SecurityDevice
  selected: boolean
  onSelect: () => void
  onRemove: () => void
  index: number
}

export function DeviceListItem({ device, selected, onSelect, onRemove, index }: Props) {
  const color = DEVICE_COLORS[device.device_type]
  const label = DEVICE_TYPE_LABELS[device.device_type]
  const Icon = DEVICE_ICON_MAP[device.device_type]

  return (
    <button
      className={`device-list-item ${selected ? 'selected' : ''}`}
      type="button"
      onClick={onSelect}
    >
      <span className="device-list-icon" style={{ background: color }}>
        {Icon && <Icon size={14} />}
      </span>
      <span className="device-list-info">
        <strong>{device.name || `${label} #${index + 1}`}</strong>
        <small>{label} · ({Math.round(device.x)}, {Math.round(device.y)})</small>
      </span>
      <span
        className="device-list-remove"
        onClick={(event) => {
          event.stopPropagation()
          onRemove()
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onRemove()
          }
        }}
        title="삭제"
      >
        Delete
      </span>
    </button>
  )
}
