import { useMemo } from 'react'
import { PageHeader } from './PageHeader'
import { useEditorStore } from '../stores/editorStore'

export function ValidationPage() {
  const walls = useEditorStore((state) => state.walls)
  const rooms = useEditorStore((state) => state.rooms)
  const devices = useEditorStore((state) => state.devices)

  const checks = useMemo(
    () => [
      {
        label: 'Geometry exists',
        passed: walls.length > 0 || rooms.length > 0,
        detail: `${walls.length} walls, ${rooms.length} rooms`,
      },
      {
        label: 'Rooms have positive area',
        passed: rooms.every((room) => room.w > 0 && room.h > 0),
        detail: `${rooms.length} rooms checked`,
      },
      {
        label: 'Security devices named',
        passed: devices.every((device) => device.name.trim().length > 0),
        detail: `${devices.length} devices checked`,
      },
      {
        label: 'Device positions are finite',
        passed: devices.every((device) => Number.isFinite(device.x) && Number.isFinite(device.y)),
        detail: 'Coordinate sanity check',
      },
    ],
    [devices, rooms, walls],
  )
  const passedCount = checks.filter((check) => check.passed).length

  return (
    <section className="page-grid editor-layout" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <PageHeader
        eyebrow="Step 6"
        title="Validation"
        description="Validate geometry, rooms, devices, and coordinate sanity before export or operations handoff."
      />

      <div className="full-width card" style={{ borderRadius: 14 }}>
        <strong>Validation Score</strong>
        <div
          style={{
            color: passedCount === checks.length ? '#4ade80' : '#fbbf24',
            fontSize: 42,
            fontWeight: 800,
            marginTop: 8,
          }}
        >
          {passedCount}/{checks.length}
        </div>
        <p className="hint">Checks run against the current editor store and update immediately as the floor plan changes.</p>
      </div>

      <div className="full-width" style={{ display: 'grid', gap: 10 }}>
        {checks.map((check) => (
          <div
            key={check.label}
            style={{
              alignItems: 'center',
              background: '#0b1220',
              border: '1px solid rgba(148, 163, 184, 0.18)',
              borderRadius: 12,
              display: 'grid',
              gap: 12,
              gridTemplateColumns: '42px minmax(0, 1fr) 120px',
              padding: '12px 14px',
            }}
          >
            <span
              aria-label={check.passed ? 'passed' : 'needs attention'}
              style={{
                background: check.passed ? '#22c55e' : '#f59e0b',
                borderRadius: 999,
                color: '#fff',
                display: 'grid',
                fontSize: 11,
                fontWeight: 800,
                height: 30,
                placeItems: 'center',
                width: 30,
              }}
            >
              {check.passed ? 'OK' : '!'}
            </span>
            <span>
              <span style={{ display: 'block', fontWeight: 700 }}>{check.label}</span>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: 12 }}>{check.detail}</span>
            </span>
            <span style={{ color: check.passed ? '#4ade80' : '#fbbf24', fontWeight: 700 }}>
              {check.passed ? 'Passed' : 'Review'}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
