const EARTH_RADIUS_METERS = 6_378_137

export type Wgs84Point = {
  longitude: number
  latitude: number
}

export type LocalPoint2D = {
  x: number
  y: number
}

export type ThreePoint = {
  x: number
  y: number
  z: number
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI
}

export function wgs84ToLocal(point: Wgs84Point, origin: Wgs84Point): LocalPoint2D {
  const latitudeScale = Math.cos(degreesToRadians(origin.latitude))
  return {
    x: degreesToRadians(point.longitude - origin.longitude) * EARTH_RADIUS_METERS * latitudeScale,
    y: degreesToRadians(point.latitude - origin.latitude) * EARTH_RADIUS_METERS,
  }
}

export function localToWgs84(point: LocalPoint2D, origin: Wgs84Point): Wgs84Point {
  const latitudeScale = Math.cos(degreesToRadians(origin.latitude))
  return {
    longitude: origin.longitude + radiansToDegrees(point.x / (EARTH_RADIUS_METERS * latitudeScale)),
    latitude: origin.latitude + radiansToDegrees(point.y / EARTH_RADIUS_METERS),
  }
}

export function local2DToThree(point: LocalPoint2D, heightMeters = 0): ThreePoint {
  return { x: point.x, y: heightMeters, z: point.y }
}

export function threeToLocal2D(point: ThreePoint): LocalPoint2D {
  return { x: point.x, y: point.z }
}
