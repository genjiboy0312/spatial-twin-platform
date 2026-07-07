import { describe, expect, it } from 'vitest'

import { local2DToThree, localToWgs84, threeToLocal2D, wgs84ToLocal } from './coordinateTransform'

describe('coordinate transforms', () => {
  it('round-trips WGS84 through local meters', () => {
    const origin = { longitude: 127.0276, latitude: 37.4979 }
    const point = { longitude: 127.0281, latitude: 37.4984 }
    const local = wgs84ToLocal(point, origin)
    const restored = localToWgs84(local, origin)

    expect(restored.longitude).toBeCloseTo(point.longitude, 8)
    expect(restored.latitude).toBeCloseTo(point.latitude, 8)
  })

  it('maps local 2D to Three.js Y-up coordinates', () => {
    const local = { x: 12, y: 34 }
    const three = local2DToThree(local, 3)

    expect(three).toEqual({ x: 12, y: 3, z: 34 })
    expect(threeToLocal2D(three)).toEqual(local)
  })
})
