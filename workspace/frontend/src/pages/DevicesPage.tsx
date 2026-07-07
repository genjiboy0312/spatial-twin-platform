import { PageHeader } from './PageHeader'
import { useEditorStore } from '../stores/editorStore'

const deviceLabels: Record<string, string> = {
  camera: 'Camera',
  sensor: 'Sensor',
  alarm: 'Alarm',
  access: 'Access Control',
}

export function DevicesPage() {
  const devices = useEditorStore((state) => state.devices)

  return (
    <section className="page-grid">
      <PageHeader
        eyebrow="Devices"
        title="Security Devices"
        description="Review the devices placed in the editor and prepare them for monitoring workflows."
      />

      {devices.length === 0 ? (
        <div className="card empty-state">
          <strong>No devices placed</strong>
          <p>Open the Editor, switch to device placement, and add cameras, sensors, alarms, or access devices.</p>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-row table-head"><span>Name</span><span>Type</span><span>Position</span><span>Status</span></div>
          {devices.map((device) => (
            <div key={device.id} className="table-row">
              <span>{device.name}</span>
              <span>{deviceLabels[device.device_type] ?? device.device_type}</span>
              <span>{device.x.toFixed(2)}, {device.y.toFixed(2)}</span>
              <span className="status-text">online</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
