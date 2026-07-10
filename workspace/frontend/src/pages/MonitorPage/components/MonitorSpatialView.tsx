import type { SecurityDevice } from '../../../stores/editorStore'

export interface MonitorSpatialViewProps {
  devices: SecurityDevice[]
  selectedDeviceId: string | null
  showCoverage: boolean
  showGps: boolean
  showPointCloud: boolean
  onSelectDevice: (id: string) => void
}

function toX(x: number) { return 40 + x * 42 }
function toY(y: number) { return 42 + y * 30 }

export function MonitorSpatialView({
  devices,
  selectedDeviceId,
  showCoverage,
  showGps,
  showPointCloud,
  onSelectDevice,
}: MonitorSpatialViewProps) {
  return (
    <svg className="monitor-spatial-view" viewBox="0 0 780 520" role="img" aria-label="Monitor spatial view">
      <defs>
        <pattern id="monitor-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="780" height="520" fill="url(#monitor-grid)" />
      {showPointCloud && Array.from({ length: 120 }, (_, i) => (
        <circle
          key={i}
          cx={110 + ((i * 47) % 560)}
          cy={90 + ((i * 31) % 340)}
          r={1.2 + (i % 4) * 0.4}
          fill="#93c5fd"
          opacity={0.18 + (i % 6) * 0.08}
        />
      ))}
      <rect x="72" y="72" width="600" height="360" rx="10" fill="rgba(24,24,27,0.38)" stroke="rgba(212,212,216,0.28)" />
      {showGps && ([
        [96, 82], [662, 88], [660, 422],
      ] as Array<[number, number]>).map(([x, y], i) => (
        <g key={`gps-${i}`}>
          <circle cx={x} cy={y} r="8" fill="#22c55e" />
          <text x={x + 12} y={y - 10} fill="#86efac" fontSize="11">GPS-{i + 1}</text>
        </g>
      ))}
      {devices.map((device) => {
        const x = toX(device.x)
        const y = toY(device.y)
        const selected = device.id === selectedDeviceId
        return (
          <g key={device.id} className="monitor-device-node" onClick={() => onSelectDevice(device.id)}>
            {showCoverage && device.device_type === 'camera' && (
              <circle cx={x} cy={y} r="80" fill="rgba(56,189,248,0.12)" stroke="rgba(56,189,248,0.18)" />
            )}
            <circle
              cx={x} cy={y}
              r={selected ? 13 : 10}
              fill={
                device.device_type === 'alarm' ? '#ef4444'
                : device.device_type === 'sensor' ? '#38bdf8'
                : device.device_type === 'access' ? '#facc15'
                : '#22c55e'
              }
              stroke="#f4f4f5" strokeWidth="1.5"
            />
            <text x={x + 14} y={y - 12} fill={selected ? '#fafafa' : '#a1a1aa'} fontSize="11">
              {device.name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
