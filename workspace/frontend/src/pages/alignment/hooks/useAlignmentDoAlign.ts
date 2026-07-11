import { useCallback, useRef } from 'react'
import { computeThreePointAlignment } from '../../../api/osm'
import { useAlignmentStore } from '../../../stores/alignmentStore'
import type { GpsAlignmentInputs, GpsAlignmentLocalPoints, PickMode } from '../types'

type AnchorTuple = [number, number, number]

interface UseAlignmentDoAlignArgs {
  currentBuildingId: number | null
  alignLocalPoints: GpsAlignmentLocalPoints
  setAlignLocalPoints: (updater: (prev: GpsAlignmentLocalPoints) => GpsAlignmentLocalPoints) => void
  alignGpsInputs: GpsAlignmentInputs
  setAlignmentError: (value: string | null) => void
  setAlignmentMatrix: (value: number[][] | null) => void
  setAlignmentRmse: (value: number | null) => void
  setTransformedGps: (value: { lat: number; lng: number } | null) => void
  setPickMode: (value: PickMode) => void
  pushUndoSnapshot: () => void
  clearAlignedMarkers: () => void
  pickMode: PickMode
  alignmentMatrix: number[][] | null
  onHoverGpsPicked: (gps: { lat: number; lng: number }) => void
  onAlignSuccess?: () => void
}

type ControlPoint = {
  local: [number, number]
  gps: [number, number]
}

function toFiniteNumber(value: string) {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function isValidLatLng(lat: number, lng: number) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

function isFiniteTuple(point: AnchorTuple) {
  return point.every((value) => Number.isFinite(value))
}

function affineTransformLocalPoint(matrix: number[][], point: AnchorTuple) {
  const row0 = matrix[0]
  const row1 = matrix[1]
  if (!row0 || !row1) return null

  const readCoefficient = (row: number[], index: number) => {
    const value = row[index]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  const a = readCoefficient(row0, 0)
  const b = readCoefficient(row0, 1)
  const c = readCoefficient(row0, 2)
  const d = readCoefficient(row1, 0)
  const e = readCoefficient(row1, 1)
  const f = readCoefficient(row1, 2)
  if (a === null || b === null || c === null || d === null || e === null || f === null) return null

  const x = point[0]
  const y = point[2]
  const lng = a * x + b * y + c
  const lat = d * x + e * y + f
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

export function useAlignmentDoAlign({
  currentBuildingId,
  alignLocalPoints,
  setAlignLocalPoints,
  alignGpsInputs,
  setAlignmentError,
  setAlignmentMatrix,
  setAlignmentRmse,
  setTransformedGps,
  setPickMode,
  pushUndoSnapshot,
  clearAlignedMarkers,
  pickMode,
  alignmentMatrix,
  onHoverGpsPicked,
  onAlignSuccess,
}: UseAlignmentDoAlignArgs) {
  const displayTransformInFlightRef = useRef(false)
  const queuedDisplayLocalPointRef = useRef<AnchorTuple | null>(null)

  const computeAlignment = useAlignmentStore((state) => state.compute)
  const applyAlignment = useAlignmentStore((state) => state.applyAlignment)
  const upsertAnchorAt = useAlignmentStore((state) => state.upsertAnchorAt)

  const handleDoAlign = useCallback(async () => {
    if (!currentBuildingId) {
      setAlignmentError('건물 정보가 없어 정합을 수행할 수 없습니다.')
      return
    }

    const { origin, point1, point2 } = alignLocalPoints
    if (!origin || !point1 || !point2) {
      setAlignmentError('Origin, Point1, Point2를 먼저 Pick 하세요.')
      return
    }

    if (!isFiniteTuple(origin) || !isFiniteTuple(point1) || !isFiniteTuple(point2)) {
      setAlignmentError('로컬 기준점 좌표는 모두 유한한 숫자여야 합니다.')
      return
    }

    const oLat = toFiniteNumber(alignGpsInputs.originLat)
    const oLng = toFiniteNumber(alignGpsInputs.originLng)
    const p1Lat = toFiniteNumber(alignGpsInputs.point1Lat)
    const p1Lng = toFiniteNumber(alignGpsInputs.point1Lng)
    const p2Lat = toFiniteNumber(alignGpsInputs.point2Lat)
    const p2Lng = toFiniteNumber(alignGpsInputs.point2Lng)

    if (oLat === null || oLng === null || p1Lat === null || p1Lng === null || p2Lat === null || p2Lng === null) {
      setAlignmentError('3개 점의 GPS(lat/lng)를 모두 숫자로 입력하세요.')
      return
    }

    if (!isValidLatLng(oLat, oLng) || !isValidLatLng(p1Lat, p1Lng) || !isValidLatLng(p2Lat, p2Lng)) {
      setAlignmentError('GPS 입력 범위를 확인하세요. (lat: -90~90, lng: -180~180)')
      return
    }

    const points: ControlPoint[] = [
      { local: [origin[0], origin[2]], gps: [oLat, oLng] },
      { local: [point1[0], point1[2]], gps: [p1Lat, p1Lng] },
      { local: [point2[0], point2[2]], gps: [p2Lat, p2Lng] },
    ]

    for (const point of points) {
      if (!Number.isFinite(point.local[0]) || !Number.isFinite(point.local[1]) || !Number.isFinite(point.gps[0]) || !Number.isFinite(point.gps[1])) {
        setAlignmentError('모든 로컬/GPS 좌표는 유한한 숫자여야 합니다.')
        return
      }
    }

    try {
      setAlignmentError(null)
      setTransformedGps(null)

      upsertAnchorAt(0, origin[0], origin[2], oLng, oLat, 'Origin')
      upsertAnchorAt(1, point1[0], point1[2], p1Lng, p1Lat, 'Point1')
      upsertAnchorAt(2, point2[0], point2[2], p2Lng, p2Lat, 'Point2')
      computeAlignment()

      const { params, result } = useAlignmentStore.getState()
      if (!params || !result) {
        throw new Error('정합 계산에 실패했습니다. 기준점 배치를 확인하세요.')
      }

      const matrix: number[][] = [
        [params.a, -params.b, params.c],
        [params.b, params.a, params.d],
      ]

      pushUndoSnapshot()
      clearAlignedMarkers()
      setAlignmentMatrix(matrix)
      const backendAlignment = await computeThreePointAlignment(currentBuildingId, points)
      setAlignmentRmse(backendAlignment.accuracy.rmse_meters)
      setPickMode('none')
      applyAlignment()
      onAlignSuccess?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : '정합 계산에 실패했습니다.'
      setAlignmentError(message)
      setAlignmentMatrix(null)
      setAlignmentRmse(null)
      setTransformedGps(null)
      clearAlignedMarkers()
    }
  }, [
    alignGpsInputs.originLat,
    alignGpsInputs.originLng,
    alignGpsInputs.point1Lat,
    alignGpsInputs.point1Lng,
    alignGpsInputs.point2Lat,
    alignGpsInputs.point2Lng,
    alignLocalPoints,
    applyAlignment,
    clearAlignedMarkers,
    computeAlignment,
    currentBuildingId,
    onAlignSuccess,
    pushUndoSnapshot,
    setAlignmentError,
    setAlignmentMatrix,
    setAlignmentRmse,
    setPickMode,
    setTransformedGps,
    upsertAnchorAt,
  ])

  const runDisplayTransform = useCallback(
    async (localPoint: AnchorTuple) => {
      if (!currentBuildingId || !alignmentMatrix) return

      if (displayTransformInFlightRef.current) {
        queuedDisplayLocalPointRef.current = localPoint
        return
      }

      displayTransformInFlightRef.current = true
      try {
        setAlignLocalPoints((prev) => ({ ...prev, display: localPoint }))
        const transformed = affineTransformLocalPoint(alignmentMatrix, localPoint)
        if (!transformed) {
          throw new Error('GPS 변환에 사용할 정합 행렬이 올바르지 않습니다.')
        }
        setTransformedGps(transformed)
        setAlignmentError(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'GPS 변환에 실패했습니다.'
        setAlignmentError(message)
        setTransformedGps(null)
      } finally {
        displayTransformInFlightRef.current = false
        const queued = queuedDisplayLocalPointRef.current
        queuedDisplayLocalPointRef.current = null
        if (queued) {
          void runDisplayTransform(queued)
        }
      }
    },
    [alignmentMatrix, currentBuildingId, setAlignLocalPoints, setAlignmentError, setTransformedGps]
  )

  const handleOsmHoverPick = useCallback(
    (gps: [number, number], localPoint: AnchorTuple) => {
      onHoverGpsPicked({ lat: gps[0], lng: gps[1] })
      if (pickMode !== 'display') return

      if (!currentBuildingId || !alignmentMatrix) {
        setAlignmentError('먼저 Do Align으로 정합을 완료하세요.')
        return
      }

      void runDisplayTransform(localPoint)
    },
    [alignmentMatrix, currentBuildingId, onHoverGpsPicked, pickMode, runDisplayTransform, setAlignmentError]
  )

  const resetDisplayQueue = useCallback(() => {
    displayTransformInFlightRef.current = false
    queuedDisplayLocalPointRef.current = null
  }, [])

  return {
    handleDoAlign,
    handleOsmHoverPick,
    resetDisplayQueue,
  }
}
