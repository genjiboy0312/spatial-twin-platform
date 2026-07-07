import { PageHeader } from './PageHeader'

export function DataSourcesPage() {
  return (
    <section className="page-grid">
      <PageHeader eyebrow="Step 2" title="Data Sources" description="DXF/Image 중심의 업로드 파이프라인을 연결할 화면입니다." />
      <article className="card">
        <strong>Upload lifecycle</strong>
        <p>uploaded → processing → parsed → failed → confirmed 상태를 기준으로 구현합니다.</p>
      </article>
    </section>
  )
}
