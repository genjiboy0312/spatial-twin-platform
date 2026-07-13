/**
 * Minimal inline SVG icons (subset of lucide-react icons).
 * Uses JSX pattern — no external dependency needed.
 */

import type { FC } from 'react'

type Props = { size?: number; className?: string }

const Svg: FC<Props & { children: React.ReactNode }> = ({ size = 16, className, children }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
)

export const MousePointer2: FC<Props> = (p) => (
  <Svg {...p}><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1 .063.91l-6.17 2.928a.5.5 0 0 0-.233.234l-2.928 6.17a.5.5 0 0 1-.91.063Z" /></Svg>
)
export const Pencil: FC<Props> = (p) => (
  <Svg {...p}><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497Z" /><path d="m15 5 4 4" /></Svg>
)
export const Square: FC<Props> = (p) => (
  <Svg {...p}><rect width="18" height="18" x="3" y="3" rx="2" /></Svg>
)
export const DoorOpen: FC<Props> = (p) => (
  <Svg {...p}><path d="M13 4h3a2 2 0 0 1 2 2v14" /><path d="M2 20h3" /><path d="M13 20h9" /><path d="M10 12v.01" /><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z" /></Svg>
)
export const AppWindow: FC<Props> = (p) => (
  <Svg {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M10 4v4" /><path d="M2 8h20" /><path d="M6 4v4" /></Svg>
)
export const SquareDashed: FC<Props> = (p) => (
  <Svg {...p}><path d="M5 3a2 2 0 0 0-2 2" /><path d="M19 3a2 2 0 0 1 2 2" /><path d="M21 19a2 2 0 0 1-2 2" /><path d="M5 21a2 2 0 0 1-2-2" /><path d="M9 3h1" /><path d="M9 21h1" /><path d="M14 3h1" /><path d="M14 21h1" /><path d="M3 9v1" /><path d="M21 9v1" /><path d="M3 14v1" /><path d="M21 14v1" /></Svg>
)
export const Trash2: FC<Props> = (p) => (
  <Svg {...p}><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></Svg>
)
export const Crosshair: FC<Props> = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="10" /><line x1="22" x2="18" y1="12" y2="12" /><line x1="6" x2="2" y1="12" y2="12" /><line x1="12" x2="12" y1="6" y2="2" /><line x1="12" x2="12" y1="22" y2="18" /></Svg>
)
export const Undo2: FC<Props> = (p) => (
  <Svg {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" /></Svg>
)
export const Redo2: FC<Props> = (p) => (
  <Svg {...p}><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" /></Svg>
)
export const ChevronUp: FC<Props> = (p) => (
  <Svg {...p}><path d="m18 15-6-6-6 6" /></Svg>
)
export const ChevronDown: FC<Props> = (p) => (
  <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
)
export const ChevronLeft: FC<Props> = (p) => (
  <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>
)
export const ChevronRight: FC<Props> = (p) => (
  <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>
)
export const Eye: FC<Props> = (p) => (
  <Svg {...p}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Svg>
)
export const EyeOff: FC<Props> = (p) => (
  <Svg {...p}><path d="m2 2 20 20" /><path d="M6.7 6.7C3.6 8.6 2 12 2 12s3 7 10 7c1.8 0 3.4-.4 4.7-1" /><path d="M19.3 15.3C21.1 13.6 22 12 22 12s-3-7-10-7c-.9 0-1.8.1-2.6.4" /></Svg>
)

export const Camera: FC<Props> = (p) => (
  <Svg {...p}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></Svg>
)
export const Radio: FC<Props> = (p) => (
  <Svg {...p}><path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9" /><path d="M7.8 13.9c-2.3-2.3-2.3-6.1 0-8.5" /><path d="M16.2 13.9c2.3-2.3 2.3-6.1 0-8.5" /><path d="M19.1 16.1c3.9-3.9 3.9-10.3 0-14.2" /><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0" /><path d="M12 21v-6" /></Svg>
)
export const Bell: FC<Props> = (p) => (
  <Svg {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></Svg>
)

export const RefreshCw: FC<Props> = (p) => (
  <Svg {...p}><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></Svg>
)
export const Plus: FC<Props> = (p) => (
  <Svg {...p}><path d="M5 12h14" /><path d="M12 5v14" /></Svg>
)
export const List: FC<Props> = (p) => (
  <Svg {...p}><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></Svg>
)

export const Upload: FC<Props> = (p) => (
  <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></Svg>
)
export const Download: FC<Props> = (p) => (
  <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></Svg>
)
