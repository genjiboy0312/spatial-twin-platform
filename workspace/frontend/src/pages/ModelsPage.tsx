import { PageHeader } from './PageHeader'

const models = [
  ['Floor Plan Mesh', '2D/3D generated wall and room model', 'Ready'],
  ['IFC Reference', 'Reserved slot for IFC model loading', 'Staged'],
  ['Point Cloud Mesh', 'Decimated LAS/LAZ/Potree preview model', 'Preview'],
]

export function ModelsPage() {
  return (
    <section className="page-grid">
      <PageHeader
        eyebrow="Models"
        title="Model Registry"
        description="Track generated model artifacts and source-derived geometry in one registry."
      />

      <div className="card-list">
        {models.map(([name, description, status]) => (
          <article key={name} className="card model-card">
            <span className="status-pill muted">{status}</span>
            <strong>{name}</strong>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
