import type { SecurityDevice } from '../../../stores/editorStore'

export interface MonitorSpatialViewProps {
  devices: SecurityDevice[]
  selectedDeviceId: string | null
  showCoverage: boolean
  showGps: boolean
  showPointCloud: boolean
  onSelectDevice: (id: string) => void
}

function toX(x: number) { return 210 + x * 24 }
function toY(y: number) { return 122 + y * 16 }

function deviceColor(deviceType: SecurityDevice['device_type']) {
  if (deviceType === 'alarm') return '#ef4444'
  if (deviceType === 'sensor') return '#38bdf8'
  if (deviceType === 'access') return '#facc15'
  return '#22c55e'
}

export function MonitorSpatialView({
  devices,
  selectedDeviceId,
  showCoverage,
  showGps,
  showPointCloud,
  onSelectDevice,
}: MonitorSpatialViewProps) {
  return (
    <svg className="monitor-spatial-view" viewBox="0 0 780 520" role="img" aria-label="Monitor map view">
      <defs>
        <linearGradient id="monitor-map-plane" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#f4f4f5" />
          <stop offset="50%" stopColor="#d4d4d8" />
          <stop offset="100%" stopColor="#a1a1aa" />
        </linearGradient>
        <linearGradient id="monitor-building-wall" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#f4f4f5" />
          <stop offset="100%" stopColor="#71717a" />
        </linearGradient>
        <filter id="monitor-soft-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="16" stdDeviation="12" floodColor="#000000" floodOpacity="0.42" />
        </filter>
        <filter id="monitor-label-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#000000" floodOpacity="0.72" />
        </filter>
        <pattern id="monitor-road-grid" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M 34 0 L 0 0 0 34" fill="none" stroke="rgba(63,63,70,0.22)" strokeWidth="1" />
        </pattern>
      </defs>

      <rect width="780" height="520" fill="transparent" />
      <g className="monitor-map-scene" filter="url(#monitor-soft-shadow)">
        <polygon
          className="monitor-map-plane"
          points="86,402 278,82 714,154 504,484"
          fill="url(#monitor-map-plane)"
        />
        <polygon points="86,402 278,82 714,154 504,484" fill="url(#monitor-road-grid)" opacity="0.72" />
        <path d="M180 344 C270 302 344 226 418 104" className="monitor-map-road wide" />
        <path d="M312 466 C358 346 458 260 666 172" className="monitor-map-road wide" />
        <path d="M132 389 C244 384 418 402 574 454" className="monitor-map-road" />
        <path d="M282 96 C386 160 500 172 702 156" className="monitor-map-road" />
        <path d="M240 386 L392 128 L444 136 L292 398 Z" className="monitor-map-green" />
        <path d="M530 170 L636 184 L590 246 L488 230 Z" className="monitor-map-green muted" />

        <g className="monitor-building-model">
          <polygon points="294,308 410,214 562,242 446,350" fill="#e4e4e7" />
          <polygon points="294,308 446,350 446,380 294,334" fill="#8b8b91" />
          <polygon points="446,350 562,242 562,270 446,380" fill="#71717a" />
          <polygon points="326,306 414,236 520,254 430,326" fill="#fafafa" stroke="#52525b" strokeWidth="1.5" />
          <path d="M354 296 L422 244 M386 315 L454 260 M420 323 L488 268" className="monitor-building-line" />
          <path d="M332 306 L428 324 L516 254" className="monitor-building-line strong" />
          <rect x="472" y="248" width="28" height="40" rx="4" fill="url(#monitor-building-wall)" transform="rotate(12 486 268)" />
          <rect x="408" y="274" width="22" height="34" rx="4" fill="url(#monitor-building-wall)" transform="rotate(12 419 291)" />
          <rect x="372" y="288" width="22" height="28" rx="4" fill="url(#monitor-building-wall)" transform="rotate(12 383 302)" />
        </g>

        <g className="monitor-map-label" filter="url(#monitor-label-shadow)">
          <rect x="104" y="90" width="132" height="28" rx="8" />
          <text x="118" y="109">OSM Map 3D</text>
        </g>
        <g className="monitor-map-label focus" filter="url(#monitor-label-shadow)">
          <rect x="396" y="184" width="88" height="30" rx="10" />
          <text x="412" y="205">3D Model</text>
        </g>
      </g>

      {showPointCloud && Array.from({ length: 120 }, (_, i) => (
        <circle
          key={i}
          cx={188 + ((i * 41) % 430)}
          cy={142 + ((i * 29) % 250)}
          r={1.2 + (i % 4) * 0.4}
          fill="#93c5fd"
          opacity={0.08 + (i % 6) * 0.045}
        />
      ))}
      {showGps && ([
        [252, 150], [626, 178], [504, 430],
      ] as Array<[number, number]>).map(([x, y], i) => (
        <g key={`gps-${i}`} className="monitor-gps-marker">
          <circle cx={x} cy={y} r="13" />
          <circle cx={x} cy={y} r="5" />
          <text x={x + 15} y={y - 10}>GPS-{i + 1}</text>
        </g>
      ))}
      {devices.map((device) => {
        const x = toX(device.x)
        const y = toY(device.y)
        const selected = device.id === selectedDeviceId
        const color = deviceColor(device.device_type)
        return (
          <g key={device.id} className="monitor-device-node" onClick={() => onSelectDevice(device.id)}>
            {showCoverage && device.device_type === 'camera' && (
              <ellipse cx={x} cy={y + 8} rx="70" ry="32" fill="rgba(56,189,248,0.12)" stroke="rgba(56,189,248,0.22)" />
            )}
            <line x1={x} y1={y + 28} x2={x} y2={y + 7} stroke={color} strokeWidth="2" opacity="0.72" />
            <ellipse cx={x} cy={y + 30} rx="14" ry="5" fill="#000000" opacity="0.34" />
            <circle
              cx={x} cy={y}
              r={selected ? 15 : 11}
              fill={color}
              stroke="#f4f4f5" strokeWidth="1.5"
            />
            <text x={x + 15} y={y - 12} className={selected ? 'selected' : ''}>{device.name}</text>
          </g>
        )
      })}
    </svg>
  )
}
