import { PageHeader } from './PageHeader'
import { useEditorStore } from '../stores/editorStore'

export function DashboardPage() {
  const walls = useEditorStore((state) => state.walls)
  const rooms = useEditorStore((state) => state.rooms)
  const devices = useEditorStore((state) => state.devices)
  const cameras = devices.filter((device) => device.device_type === 'camera').length

  return (
    <section className="page-grid">
      <PageHeader
        eyebrow="Dashboard"
        title="Operations Overview"
        description="A compact SOC-style overview of model readiness, security devices, and live workflow status."
      />

      <div className="kpi-grid">
        <article className="kpi-card"><span>Walls</span><strong>{walls.length}</strong><small>Geometry primitives</small></article>
        <article className="kpi-card"><span>Rooms</span><strong>{rooms.length}</strong><small>Space definitions</small></article>
        <article className="kpi-card"><span>Devices</span><strong>{devices.length}</strong><small>{cameras} cameras</small></article>
        <article className="kpi-card"><span>Status</span><strong>Ready</strong><small>Docker stack online</small></article>
      </div>

      <div className="dashboard-grid">
        <article className="card">
          <strong>Workflow Status</strong>
          <div className="timeline-list">
            {['Projects', 'Data Sources', 'Editor', 'Alignment', 'Validation', 'Monitor'].map((step, index) => (
              <span key={step}><i>{index + 1}</i>{step}</span>
            ))}
          </div>
        </article>
        <article className="card">
          <strong>Site Health</strong>
          <p>Backend, frontend, PostGIS, and Redis are available through Docker Compose.</p>
          <div className="chip-list">
            <span className="chip gray">Frontend :5174</span>
            <span className="chip gray">API :8000</span>
            <span className="chip gray">PostGIS :15432</span>
            <span className="chip gray">Redis :16379</span>
          </div>
        </article>
      </div>
    </section>
  )
}
