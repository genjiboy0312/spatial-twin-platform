import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from './PageHeader'
import { listBuildings } from '../api/buildings'
import type { Building } from '../api/buildings'
import { CreateBuildingModal } from './CreateBuildingModal'

type BuildingWithCreatedAt = Building & {
  created_at?: string | null
}

function formatCreatedAt(building: Building): string {
  const createdAt = (building as BuildingWithCreatedAt).created_at
  if (!createdAt) return '생성 시간 정보 없음'

  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return '생성 시간 정보 없음'

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function ProjectsPage() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const fetchBuildings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listBuildings()
      setBuildings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '건물 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBuildings()
  }, [fetchBuildings])

  const handleCreated = async () => {
    await fetchBuildings()
    setShowModal(false)
  }

  return (
    <section className="page-grid">
      <PageHeader
        eyebrow="Step 1"
        title="Projects"
        description="건물을 만들고 WGS84 origin을 설정하는 시작 화면입니다."
      />

      <div className="projects-toolbar">
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          건물 생성
        </button>
      </div>

      {loading && (
        <div className="card-list">
          {[1, 2, 3].map((i) => (
            <article key={i} className="card skeleton-card">
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
            </article>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="card emphasis">
          <strong>오류</strong>
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={fetchBuildings}>
            다시 시도
          </button>
        </div>
      )}

      {!loading && !error && buildings.length === 0 && (
        <div className="card emphasis">
          <strong>첫 건물을 생성하세요</strong>
          <p>프로젝트를 시작하려면 건물을 하나 만들어주세요.</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            건물 생성하기
          </button>
        </div>
      )}

      {!loading && !error && buildings.length > 0 && (
        <div className="card-list">
          {buildings.map((b) => (
            <article key={b.id} className="card building-card">
              <strong className="building-name">{b.name}</strong>
              <p className="building-address">{b.address ?? '주소 정보 없음'}</p>
              <div className="building-meta">
                <span>{b.total_floors}개 층</span>
                <span>생성: {formatCreatedAt(b)}</span>
                {b.origin_longitude != null && b.origin_latitude != null && (
                  <span className="building-coords">
                    위도 {b.origin_latitude.toFixed(4)} · 경도 {b.origin_longitude.toFixed(4)}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {showModal && (
        <CreateBuildingModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </section>
  )
}
