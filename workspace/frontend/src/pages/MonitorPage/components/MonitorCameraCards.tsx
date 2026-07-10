import type { SecurityDevice } from '../../../stores/editorStore'
import { Camera } from '../monitorIcons'

export interface MonitorCameraCardsProps {
  cameras: SecurityDevice[]
  selectedDeviceId: string | null
  labels: {
    online: string
    noCameras: string
  }
  onSelect: (id: string) => void
}

export function MonitorCameraCards({ cameras, selectedDeviceId, labels, onSelect }: MonitorCameraCardsProps) {
  if (cameras.length === 0) {
    return <div className="monitor-panel-empty">{labels.noCameras}</div>
  }

  return (
    <div className="monitor-camera-strip">
      {cameras.map((camera) => (
        <button
          key={camera.id}
          type="button"
          className={selectedDeviceId === camera.id ? 'selected' : ''}
          onClick={() => onSelect(camera.id)}
        >
          <div className="monitor-camera-preview">
            <Camera size={28} strokeWidth={1.5} />
            <span>LIVE</span>
          </div>
          <strong>{camera.name}</strong>
          <small>{labels.online}</small>
        </button>
      ))}
    </div>
  )
}
