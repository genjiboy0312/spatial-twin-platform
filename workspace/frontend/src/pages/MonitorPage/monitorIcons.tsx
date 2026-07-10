import type { ReactNode } from 'react'

type IconProps = { size?: number; className?: string; style?: React.CSSProperties; strokeWidth?: number }

function icon(children: ReactNode, defaultStrokeWidth = 2) {
  return ({ size = 24, className, style, strokeWidth }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? defaultStrokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {children}
    </svg>
  )
}

const P = (d: string) => <path d={d} />
const C = (cx: number, cy: number, r: number) => <circle cx={cx} cy={cy} r={r} />
const L = (x1: number, y1: number, x2: number, y2: number) => <line x1={x1} y1={y1} x2={x2} y2={y2} />
const R = (x: number, y: number, w: number, h: number, rx?: number) => <rect x={x} y={y} width={w} height={h} rx={rx ?? 0} ry={rx ?? 0} />
const PL = (pts: string) => <polyline points={pts} />

export const ArrowLeft = icon(<>{P('M19 12H5')}{P('M12 19l-7-7 7-7')}</>)
export const Building2 = icon(<>{R(3, 2, 18, 20, 2)}{P('M9 22v-4h6v4')}{P('M8 6h.01')}{P('M16 6h.01')}{P('M12 6h.01')}{P('M12 10h.01')}{P('M12 14h.01')}{P('M16 10h.01')}{P('M16 14h.01')}{P('M8 10h.01')}{P('M8 14h.01')}</>)
export const Camera = icon(<>{P('M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z')}{C(12, 13, 3)}</>)
export const CheckCircle2 = icon(<>{P('M9 12l2 2 4-4')}{C(12, 12, 10)}</>)
export const ChevronDown = icon(<>{P('M6 9l6 6 6-6')}</>)
export const ChevronUp = icon(<>{P('M6 15l6-6 6 6')}</>)
export const ClipboardList = icon(<>{R(3, 3, 18, 18, 2)}{L(8, 9, 16, 9)}{L(8, 13, 16, 13)}{L(8, 17, 12, 17)}</>)
export const MapPin = icon(<>{P('M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z')}{C(12, 10, 3)}</>)
export const Shield = icon(<>{P('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z')}</>)
export const Terminal = icon(<>{PL('4 17 10 11 4 5')}{L(12, 19, 20, 19)}</>)
export const LayoutPanelLeft = icon(<>{R(3, 3, 7, 7)}{R(14, 3, 7, 7)}{R(3, 14, 7, 7)}{R(14, 14, 7, 7)}</>)
export const RefreshCw = icon(<>{P('M21 2v6h-6')}{P('M3 12a9 9 0 0115-6.7L21 8')}{P('M3 22v-6h6')}{P('M21 12a9 9 0 01-15 6.7L3 16')}</>)
export const AlertCircle = icon(<>{C(12, 12, 10)}{L(12, 8, 12, 12)}{L(12, 16, 12.01, 16)}</>)
export const AlertTriangle = icon(<>{P('M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z')}{L(12, 9, 12, 13)}{L(12, 17, 12.01, 17)}</>)
export const Info = icon(<>{C(12, 12, 10)}{L(12, 16, 12, 12)}{L(12, 8, 12.01, 8)}</>)
export const Radio = icon(<>{P('M4.9 16.1C1 12.2 1 5.8 4.9 1.9')}{P('M7.8 13.2c-2.3-2.3-2.3-6.1 0-8.5')}{P('M16.2 4.8c2.3 2.3 2.3 6.1 0 8.5')}{P('M19.1 1.9c3.9 3.9 3.9 10.3 0 14.2')}{L(12, 11, 12, 13)}{C(12, 9, 2)}{P('M10 20l2 5 2-5')}</>)
export const Fingerprint = icon(<>{P('M2 12C2 6.5 6.5 2 12 2s10 4.5 10 10')}{P('M6 12a6 6 0 0112 0')}{P('M8 12a4 4 0 018 0')}{C(12, 12, 2)}</>)
export const Bell = icon(<>{P('M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9')}{P('M13.73 21a2 2 0 01-3.46 0')}</>)
export const Search = icon(<>{C(11, 11, 8)}{L(21, 21, 16.65, 16.65)}</>)
export const Wifi = icon(<>{P('M5 12.55a11 11 0 0114.08 0')}{P('M1.42 9a16 16 0 0121.16 0')}{P('M8.53 16.11a6 6 0 016.95 0')}{C(12, 20, 1)}</>)
export const Monitor = icon(<>{R(2, 3, 20, 14, 2)}{L(8, 21, 16, 21)}{L(12, 17, 12, 21)}</>)
