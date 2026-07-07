# Coordinate System Contract

## Canonical storage

- Spatial database geometry uses WGS84 / SRID 4326.
- Longitude is X-like horizontal east/west.
- Latitude is Y-like north/south in geospatial storage.

## Local rendering coordinates

- Each building has `origin_longitude` and `origin_latitude`.
- Frontend rendering uses local meter offsets from the building origin.
- Canvas 2D uses `{ x, y }` where `x` is east meters and `y` is north meters.
- Three.js uses Y-up: `{ x, y, z }` where `x` is east meters, `y` is height, and `z` is north meters.

## Required invariant

`localToWgs84(wgs84ToLocal(point, origin), origin)` must return the original point within a small tolerance.
