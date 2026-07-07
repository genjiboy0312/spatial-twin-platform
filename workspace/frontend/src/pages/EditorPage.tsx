import { PageHeader } from './PageHeader'

export function EditorPage() {
  return (
    <section className="page-grid editor-layout">
      <PageHeader eyebrow="Step 3" title="2D / 3D Editor" description="좌표 변환 테스트가 통과한 뒤 뷰어와 편집기를 확장합니다." />
      <div className="viewer-placeholder">
        <span>Canvas 2D / Three.js viewport placeholder</span>
      </div>
      <aside className="inspector card">
        <strong>Property Panel</strong>
        <p>선택된 Wall, Room, Device 속성을 편집할 영역입니다.</p>
      </aside>
    </section>
  )
}
