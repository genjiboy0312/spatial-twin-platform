import { type Wgs84Point, type LocalPoint2D } from './coordinateTransform'

export type AnchorPoint = {
  id: string
  localX: number
  localY: number
  longitude: number
  latitude: number
  label: string
}

export type HelmertParams = {
  a: number
  b: number
  c: number
  d: number
}

export type ResidualInfo = {
  local: LocalPoint2D
  wgs84: Wgs84Point
  residualMeters: number
}

export type AlignmentResult = {
  params: HelmertParams
  residuals: ResidualInfo[]
  rmsErrorMeters: number
  anchorCount: number
}

function solve4x4(A: number[], b: number[]): number[] | null {
  const m = new Array<number>(20)
  for (let i = 0; i < 4; i++) {
    const r4 = i * 4
    const r5 = i * 5
    m[r5] = A[r4]!
    m[r5 + 1] = A[r4 + 1]!
    m[r5 + 2] = A[r4 + 2]!
    m[r5 + 3] = A[r4 + 3]!
    m[r5 + 4] = b[i]!
  }

  for (let col = 0; col < 4; col++) {
    let maxRow = col
    for (let row = col + 1; row < 4; row++) {
      if (Math.abs(m[row * 5 + col]!) > Math.abs(m[maxRow * 5 + col]!)) {
        maxRow = row
      }
    }
    if (Math.abs(m[maxRow * 5 + col]!) < 1e-12) return null

    for (let j = col; j < 5; j++) {
      const tmp = m[col * 5 + j]!
      m[col * 5 + j] = m[maxRow * 5 + j]!
      m[maxRow * 5 + j] = tmp
    }

    const pivot = m[col * 5 + col]!
    for (let j = col; j < 5; j++) {
      m[col * 5 + j] = m[col * 5 + j]! / pivot
    }

    for (let row = 0; row < 4; row++) {
      if (row === col) continue
      const factor = m[row * 5 + col]!
      for (let j = col; j < 5; j++) {
        m[row * 5 + j] = m[row * 5 + j]! - factor * m[col * 5 + j]!
      }
    }
  }

  return [m[4]!, m[9]!, m[14]!, m[19]!]
}

export function computeHelmertTransformation(anchors: AnchorPoint[]): HelmertParams | null {
  if (anchors.length < 2) return null

  let n00 = 0; let n01 = 0; let n02 = 0; let n03 = 0
  let n10 = 0; let n11 = 0; let n12 = 0; let n13 = 0
  let n20 = 0; let n21 = 0; let n22 = 0; let n23 = 0
  let n30 = 0; let n31 = 0; let n32 = 0; let n33 = 0
  let r0 = 0; let r1 = 0; let r2 = 0; let r3 = 0

  for (const ap of anchors) {
    const x = ap.localX
    const y = ap.localY
    const lon = ap.longitude
    const lat = ap.latitude

    n00 += x * x
    n01 += -x * y
    n02 += x
    r0 += x * lon

    n10 += -x * y
    n11 += y * y
    n12 += -y
    r1 += -y * lon

    n20 += x
    n21 += -y
    n22 += 1
    r2 += lon

    n00 += y * y
    n01 += x * y
    n03 += y
    r0 += y * lat

    n10 += x * y
    n11 += x * x
    n13 += x
    r1 += x * lat

    n30 += y
    n31 += x
    n33 += 1
    r3 += lat
  }

  const sol = solve4x4(
    [n00, n01, n02, n03, n10, n11, n12, n13, n20, n21, n22, n23, n30, n31, n32, n33],
    [r0, r1, r2, r3],
  )
  if (!sol) return null
  return { a: sol[0]!, b: sol[1]!, c: sol[2]!, d: sol[3]! }
}

export function localToWgs84Helmert(point: LocalPoint2D, params: HelmertParams): Wgs84Point {
  return {
    longitude: params.a * point.x - params.b * point.y + params.c,
    latitude: params.b * point.x + params.a * point.y + params.d,
  }
}

export function wgs84ToLocalHelmert(point: Wgs84Point, params: HelmertParams): LocalPoint2D {
  const denom = params.a * params.a + params.b * params.b
  if (denom === 0) return { x: 0, y: 0 }
  return {
    x: (params.a * (point.longitude - params.c) + params.b * (point.latitude - params.d)) / denom,
    y: (-params.b * (point.longitude - params.c) + params.a * (point.latitude - params.d)) / denom,
  }
}

export function computeAlignmentQuality(anchors: AnchorPoint[], params: HelmertParams): AlignmentResult {
  const residuals: ResidualInfo[] = anchors.map((ap) => {
    const predicted = localToWgs84Helmert({ x: ap.localX, y: ap.localY }, params)
    const dLon = (predicted.longitude - ap.longitude) * Math.cos((ap.latitude * Math.PI) / 180) * 111_320
    const dLat = (predicted.latitude - ap.latitude) * 111_320
    const residualMeters = Math.sqrt(dLon * dLon + dLat * dLat)
    return { local: { x: ap.localX, y: ap.localY }, wgs84: predicted, residualMeters }
  })

  const rmsErrorMeters = Math.sqrt(
    residuals.reduce((sum, r) => sum + r.residualMeters * r.residualMeters, 0) / residuals.length,
  )

  return { params, residuals, rmsErrorMeters, anchorCount: anchors.length }
}

export function formatAlignmentParams(params: HelmertParams): string {
  const scale = Math.sqrt(params.a * params.a + params.b * params.b)
  const rotationRad = Math.atan2(params.b, params.a)
  const rotationDeg = (rotationRad * 180) / Math.PI
  return [
    `Scale: ${scale.toFixed(6)}`,
    `Rotation: ${rotationDeg.toFixed(4)} deg`,
    `Translation: (${params.c.toFixed(6)}, ${params.d.toFixed(6)})`,
  ].join(' | ')
}

export function getBuildingOriginFromAnchors(anchors: AnchorPoint[]): Wgs84Point | null {
  if (anchors.length === 0) return null
  const avgLon = anchors.reduce((s, a) => s + a.longitude, 0) / anchors.length
  const avgLat = anchors.reduce((s, a) => s + a.latitude, 0) / anchors.length
  return { longitude: avgLon, latitude: avgLat }
}
