import { Link } from 'react-router'
import { PageHeader } from './PageHeader'

const quickLinks = [
  ['Open Editor', '/editor/demo', 'Draw, inspect, and switch between 2D and 3D views.'],
  ['Run Alignment', '/alignment', 'Match local drawing coordinates to real-world GPS anchors.'],
  ['Review Coverage', '/coverage', 'Check camera coverage and uncovered spaces.'],
  ['Monitor Site', '/monitor', 'Watch events, alerts, and system status.'],
] as const

export function HomePage() {
  return (
    <section className="page-grid">
      <PageHeader
        eyebrow="Home"
        title="Spatial Twin Platform"
        description="A black-and-gray operations workspace for building geometry, devices, point clouds, validation, and monitoring."
      />

      <div className="hero-panel">
        <div>
          <span className="eyebrow-muted">Security digital twin</span>
          <h2>From floor source to operational view</h2>
          <p>
            Start with buildings and source files, refine the model in the editor, align it to GPS, then validate and
            monitor the result from one workspace.
          </p>
        </div>
        <div className="hero-metrics">
          <span><strong>12</strong> workflow screens</span>
          <span><strong>4</strong> analysis tools</span>
          <span><strong>Live</strong> Docker stack</span>
        </div>
      </div>

      <div className="card-list">
        {quickLinks.map(([label, to, description]) => (
          <Link key={to} className="card action-card" to={to}>
            <strong>{label}</strong>
            <p>{description}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
