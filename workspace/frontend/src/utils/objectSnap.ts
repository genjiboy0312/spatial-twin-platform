export type Vec2 = { x: number; y: number }

export enum SnapType {
  ENDPOINT = 'endpoint',
  MIDPOINT = 'midpoint',
  CENTER = 'center',
  INTERSECTION = 'intersection',
  PERPENDICULAR = 'perpendicular',
  TANGENT = 'tangent',
  NEAREST = 'nearest',
  GRID = 'grid',
}

export interface SnapPoint {
  type: SnapType
  point: Vec2
  distance: number
}

export interface SnapConfig {
  enabled: boolean
  types: SnapType[]
  gridSize: number
  tolerance: number
  endpointThreshold: number
}

export const SNAP_TYPE_LABELS: Record<SnapType, string> = {
  [SnapType.ENDPOINT]: 'Endpoint',
  [SnapType.MIDPOINT]: 'Midpoint',
  [SnapType.CENTER]: 'Center',
  [SnapType.INTERSECTION]: 'Intersection',
  [SnapType.PERPENDICULAR]: 'Perpendicular',
  [SnapType.TANGENT]: 'Tangent',
  [SnapType.NEAREST]: 'Nearest',
  [SnapType.GRID]: 'Grid',
}

export const SNAP_TYPE_KOR_LABELS: Record<SnapType, string> = {
  [SnapType.ENDPOINT]: '끝점',
  [SnapType.MIDPOINT]: '중간점',
  [SnapType.CENTER]: '중심점',
  [SnapType.INTERSECTION]: '교차점',
  [SnapType.PERPENDICULAR]: '수직',
  [SnapType.TANGENT]: '접선',
  [SnapType.NEAREST]: '최근접',
  [SnapType.GRID]: '그리드',
}

export const SNAP_TYPE_SHORTCUTS: Record<SnapType, string> = {
  [SnapType.ENDPOINT]: 'E',
  [SnapType.MIDPOINT]: 'M',
  [SnapType.CENTER]: 'C',
  [SnapType.INTERSECTION]: 'I',
  [SnapType.PERPENDICULAR]: 'P',
  [SnapType.TANGENT]: 'T',
  [SnapType.NEAREST]: 'N',
  [SnapType.GRID]: 'G',
}

export const SNAP_TYPE_ICONS: Record<SnapType, string> = {
  [SnapType.ENDPOINT]: '●',
  [SnapType.MIDPOINT]: '◐',
  [SnapType.CENTER]: '◎',
  [SnapType.INTERSECTION]: '✚',
  [SnapType.PERPENDICULAR]: '⊥',
  [SnapType.TANGENT]: '⌒',
  [SnapType.NEAREST]: '⋅',
  [SnapType.GRID]: '＃',
}

export function createDefaultSnapConfig(): SnapConfig {
  return {
    enabled: true,
    types: [SnapType.ENDPOINT, SnapType.MIDPOINT, SnapType.GRID],
    gridSize: 1.0,
    tolerance: 10,
    endpointThreshold: 0.5,
  }
}

export function snapToGrid(point: Vec2, gridSize: number): Vec2 {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  }
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function findNearestEndpoint(
  point: Vec2,
  endpoints: Vec2[],
  threshold: number,
): Vec2 | null {
  let best: Vec2 | null = null
  let bestDist = threshold
  for (const ep of endpoints) {
    const d = dist(point, ep)
    if (d < bestDist) {
      bestDist = d
      best = ep
    }
  }
  return best
}

export function findMidpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function findNearestPointOnSegment(
  point: Vec2,
  a: Vec2,
  b: Vec2,
): Vec2 | null {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return null
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return { x: a.x + t * dx, y: a.y + t * dy }
}

function lineIntersection(
  a1: Vec2, a2: Vec2,
  b1: Vec2, b2: Vec2,
): Vec2 | null {
  const d1x = a2.x - a1.x
  const d1y = a2.y - a1.y
  const d2x = b2.x - b1.x
  const d2y = b2.y - b1.y
  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < 1e-10) return null
  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / denom
  const u = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / denom
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: a1.x + t * d1x, y: a1.y + t * d1y }
}

export class ObjectSnapManager {
  private config: SnapConfig
  private wallEndpoints: Vec2[] = []
  private wallSegments: [Vec2, Vec2][] = []

  constructor(config?: Partial<SnapConfig>) {
    this.config = { ...createDefaultSnapConfig(), ...config }
  }

  setConfig(config: Partial<SnapConfig>) {
    this.config = { ...this.config, ...config }
  }

  getConfig(): SnapConfig {
    return { ...this.config }
  }

  updateWalls(walls: { x1: number; y1: number; x2: number; y2: number }[]) {
    const endpoints: Vec2[] = []
    const segments: [Vec2, Vec2][] = []
    for (const w of walls) {
      const a: Vec2 = { x: w.x1, y: w.y1 }
      const b: Vec2 = { x: w.x2, y: w.y2 }
      endpoints.push(a, b)
      segments.push([a, b])
    }
    this.wallEndpoints = endpoints
    this.wallSegments = segments
  }

  snap(point: Vec2): { point: Vec2; activeSnap: SnapType | null } {
    if (!this.config.enabled) return { point, activeSnap: null }

    const { types, gridSize, endpointThreshold } = this.config
    let bestPoint = { ...point }
    let bestSnap: SnapType | null = null
    let bestDist = Infinity

    // Grid snap
    if (types.includes(SnapType.GRID)) {
      const gridPoint = snapToGrid(point, gridSize)
      const d = dist(point, gridPoint)
      if (d < bestDist) {
        bestDist = d
        bestPoint = gridPoint
        bestSnap = SnapType.GRID
      }
    }

    // Endpoint snap
    if (types.includes(SnapType.ENDPOINT)) {
      const ep = findNearestEndpoint(point, this.wallEndpoints, endpointThreshold)
      if (ep) {
        const d = dist(point, ep)
        if (d < bestDist) {
          bestDist = d
          bestPoint = ep
          bestSnap = SnapType.ENDPOINT
        }
      }
    }

    // Midpoint snap
    if (types.includes(SnapType.MIDPOINT)) {
      for (const [a, b] of this.wallSegments) {
        const mp = findMidpoint(a, b)
        const d = dist(point, mp)
        if (d < endpointThreshold && d < bestDist) {
          bestDist = d
          bestPoint = mp
          bestSnap = SnapType.MIDPOINT
        }
      }
    }

    // Nearest on segment
    if (types.includes(SnapType.NEAREST)) {
      for (const [a, b] of this.wallSegments) {
        const np = findNearestPointOnSegment(point, a, b)
        if (np) {
          const d = dist(point, np)
          if (d < endpointThreshold && d < bestDist) {
            bestDist = d
            bestPoint = np
            bestSnap = SnapType.NEAREST
          }
        }
      }
    }

    // Intersection snap
    if (types.includes(SnapType.INTERSECTION)) {
      for (let i = 0; i < this.wallSegments.length; i++) {
        for (let j = i + 1; j < this.wallSegments.length; j++) {
          const first = this.wallSegments[i]
          const second = this.wallSegments[j]
          if (!first || !second) continue
          const ip = lineIntersection(
            first[0], first[1],
            second[0], second[1],
          )
          if (ip) {
            const d = dist(point, ip)
            if (d < endpointThreshold && d < bestDist) {
              bestDist = d
              bestPoint = ip
              bestSnap = SnapType.INTERSECTION
            }
          }
        }
      }
    }

    return { point: bestPoint, activeSnap: bestSnap }
  }
}
