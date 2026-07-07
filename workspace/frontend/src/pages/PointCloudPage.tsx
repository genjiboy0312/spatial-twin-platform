import { useMemo, useState } from 'react'
import { PageHeader } from './PageHeader'

type PointCloudFile = {
  id: string
  name: string
  format: 'LAS' | 'LAZ' | 'Potree'
  sizeMb: number
  points: number
  status: 'ready' | 'queued' | 'processing'
}

const SAMPLE_CLOUDS: PointCloudFile[] = [
  { id: 'pc-1', name: 'HQ exterior scan', format: 'LAZ', sizeMb: 184.2, points: 12_480_000, status: 'ready' },
  { id: 'pc-2', name: 'Lobby terrestrial scan', format: 'LAS', sizeMb: 92.6, points: 5_230_000, status: 'ready' },
  { id: 'pc-3', name: 'Basement Potree tiles', format: 'Potree', sizeMb: 318.4, points: 21_900_000, status: 'queued' },
]

const POINTS = Array.from({ length: 240 }, (_, index) => {
  const angle = index * 0.34
  const radius = 35 + (index % 29) * 4.2
  return {
    x: 380 + Math.cos(angle) * radius + ((index * 17) % 31) - 15,
    y: 210 + Math.sin(angle * 0.74) * radius * 0.55 + ((index * 11) % 23) - 11,
    z: (index * 7) % 80,
  }
})

function formatPoints(points: number): string {
  if (points >= 1_000_000) return `${(points / 1_000_000).toFixed(1)}M`
  if (points >= 1_000) return `${(points / 1_000).toFixed(1)}K`
  return String(points)
}

export function PointCloudPage() {
  const [clouds, setClouds] = useState<PointCloudFile[]>(SAMPLE_CLOUDS)
  const [selectedId, setSelectedId] = useState(SAMPLE_CLOUDS[0]?.id ?? '')
  const selectedCloud = clouds.find((cloud) => cloud.id === selectedId) ?? clouds[0]

  const stats = useMemo(
    () => ({
      totalFiles: clouds.length,
      totalPoints: clouds.reduce((sum, cloud) => sum + cloud.points, 0),
      totalSize: clouds.reduce((sum, cloud) => sum + cloud.sizeMb, 0),
      readyFiles: clouds.filter((cloud) => cloud.status === 'ready').length,
    }),
    [clouds],
  )

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toUpperCase()
    const format = ext === 'LAZ' ? 'LAZ' : ext === 'LAS' ? 'LAS' : 'Potree'
    const nextCloud: PointCloudFile = {
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[^.]+$/, ''),
      format,
      sizeMb: Math.max(file.size / 1024 / 1024, 0.1),
      points: Math.round(Math.max(file.size / 18, 10_000)),
      status: 'queued',
    }

    setClouds((current) => [nextCloud, ...current])
    setSelectedId(nextCloud.id)
    event.target.value = ''
  }

  return (
    <section className="page-grid editor-layout" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <PageHeader
        eyebrow="Phase 6"
        title="Point Cloud"
        description="Manage LAS, LAZ, and Potree point-cloud sources before alignment, validation, and 3D review."
      />

      <div className="full-width" style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: 18 }}>
        <aside className="card" style={{ borderRadius: 14 }}>
          <strong>Point Cloud Sources</strong>
          <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>
            Upload or stage scans. Files are tracked with processing state so a backend parser can attach later.
          </p>
          <label className="btn btn-primary" style={{ justifyContent: 'center', marginBottom: 14 }}>
            Add LAS/LAZ
            <input accept=".las,.laz,.json" onChange={handleFileSelect} style={{ display: 'none' }} type="file" />
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            {clouds.map((cloud) => (
              <button
                key={cloud.id}
                type="button"
                onClick={() => setSelectedId(cloud.id)}
                style={{
                  background: cloud.id === selectedCloud?.id ? 'rgba(59, 130, 246, 0.18)' : 'rgba(15, 23, 42, 0.62)',
                  border: `1px solid ${cloud.id === selectedCloud?.id ? '#38bdf8' : 'rgba(148, 163, 184, 0.14)'}`,
                  borderRadius: 10,
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  padding: 10,
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{cloud.name}</span>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: 11 }}>
                  {cloud.format} | {cloud.sizeMb.toFixed(1)} MB | {cloud.status}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="viewer-container" style={{ minHeight: 520 }}>
          <svg
            aria-label="Point cloud preview"
            role="img"
            viewBox="0 0 760 420"
            style={{
              background:
                'radial-gradient(circle at 50% 45%, rgba(59,130,246,0.2), transparent 38%), linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px), #0b1220',
              backgroundSize: 'auto, 32px 32px, 32px 32px',
              border: '1px solid rgba(148, 163, 184, 0.18)',
              borderRadius: 16,
              display: 'block',
              width: '100%',
            }}
          >
            {POINTS.map((point, index) => (
              <circle
                key={`${point.x}-${point.y}-${index}`}
                cx={point.x}
                cy={point.y}
                fill={`rgb(${80 + point.z * 2}, ${150 + point.z}, 255)`}
                opacity={0.42 + point.z / 160}
                r={1.4 + point.z / 70}
              />
            ))}
            <text x="24" y="34" fill="#bfdbfe" fontSize="14" fontWeight="700">
              {selectedCloud?.name ?? 'No point cloud selected'}
            </text>
            <text x="24" y="56" fill="#94a3b8" fontSize="12">
              Preview uses decimated sample points; full-resolution tiles remain staged for backend processing.
            </text>
          </svg>

          <div className="card-list" style={{ marginTop: 16 }}>
            <div className="card" style={{ borderRadius: 14 }}>
              <strong>{formatPoints(stats.totalPoints)}</strong>
              <p>Total staged points</p>
            </div>
            <div className="card" style={{ borderRadius: 14 }}>
              <strong>{stats.totalSize.toFixed(1)} MB</strong>
              <p>Total source size</p>
            </div>
            <div className="card" style={{ borderRadius: 14 }}>
              <strong>{stats.readyFiles}/{stats.totalFiles}</strong>
              <p>Ready for validation</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
