import { useCallback, useRef, useState } from 'react'
import type { GpsAlignmentInputs, GpsAlignmentLocalPoints, PickMode } from '../types'

type AnchorTuple = [number, number, number]
type StateSetter<T> = (value: T | ((prev: T) => T)) => void

type AlignmentUndoSnapshot = {
  alignLocalPoints: GpsAlignmentLocalPoints
  alignGpsInputs: GpsAlignmentInputs
  alignmentMatrix: number[][] | null
  alignmentRmse: number | null
  transformedGps: { lat: number; lng: number } | null
  pickMode: PickMode
}

interface UseAlignmentHistoryArgs {
  alignLocalPoints: GpsAlignmentLocalPoints
  setAlignLocalPoints: StateSetter<GpsAlignmentLocalPoints>
  alignGpsInputs: GpsAlignmentInputs
  setAlignGpsInputs: StateSetter<GpsAlignmentInputs>
  alignmentMatrix: number[][] | null
  setAlignmentMatrix: (value: number[][] | null) => void
  alignmentRmse: number | null
  setAlignmentRmse: (value: number | null) => void
  transformedGps: { lat: number; lng: number } | null
  setTransformedGps: (value: { lat: number; lng: number } | null) => void
  pickMode: PickMode
  setPickMode: (value: PickMode) => void
  setAlignmentError: (value: string | null) => void
}

const MAX_HISTORY = 50

function cloneAnchorTuple(point: AnchorTuple | null): AnchorTuple | null {
  return point ? [point[0], point[1], point[2]] : null
}

function cloneLocalPoints(points: GpsAlignmentLocalPoints): GpsAlignmentLocalPoints {
  return {
    origin: cloneAnchorTuple(points.origin),
    point1: cloneAnchorTuple(points.point1),
    point2: cloneAnchorTuple(points.point2),
    display: cloneAnchorTuple(points.display),
  }
}

function cloneMatrix(matrix: number[][] | null) {
  return matrix ? matrix.map((row) => [...row]) : null
}

export function useAlignmentHistory({
  alignLocalPoints,
  setAlignLocalPoints,
  alignGpsInputs,
  setAlignGpsInputs,
  alignmentMatrix,
  setAlignmentMatrix,
  alignmentRmse,
  setAlignmentRmse,
  transformedGps,
  setTransformedGps,
  pickMode,
  setPickMode,
  setAlignmentError,
}: UseAlignmentHistoryArgs) {
  const undoStackRef = useRef<AlignmentUndoSnapshot[]>([])
  const redoStackRef = useRef<AlignmentUndoSnapshot[]>([])
  const isApplyingUndoRedoRef = useRef(false)
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)

  const syncUndoRedoCounts = useCallback(() => {
    setUndoCount(undoStackRef.current.length)
    setRedoCount(redoStackRef.current.length)
  }, [])

  const captureSnapshot = useCallback((): AlignmentUndoSnapshot => ({
    alignLocalPoints: cloneLocalPoints(alignLocalPoints),
    alignGpsInputs: { ...alignGpsInputs },
    alignmentMatrix: cloneMatrix(alignmentMatrix),
    alignmentRmse,
    transformedGps: transformedGps ? { ...transformedGps } : null,
    pickMode,
  }), [alignGpsInputs, alignLocalPoints, alignmentMatrix, alignmentRmse, pickMode, transformedGps])

  const restoreSnapshot = useCallback((snapshot: AlignmentUndoSnapshot) => {
    isApplyingUndoRedoRef.current = true
    setAlignLocalPoints(cloneLocalPoints(snapshot.alignLocalPoints))
    setAlignGpsInputs({ ...snapshot.alignGpsInputs })
    setAlignmentMatrix(cloneMatrix(snapshot.alignmentMatrix))
    setAlignmentRmse(snapshot.alignmentRmse)
    setTransformedGps(snapshot.transformedGps ? { ...snapshot.transformedGps } : null)
    setPickMode(snapshot.pickMode)
    setAlignmentError(null)
    isApplyingUndoRedoRef.current = false
  }, [setAlignGpsInputs, setAlignLocalPoints, setAlignmentError, setAlignmentMatrix, setAlignmentRmse, setPickMode, setTransformedGps])

  const pushUndoSnapshot = useCallback(() => {
    if (isApplyingUndoRedoRef.current) return
    undoStackRef.current.push(captureSnapshot())
    if (undoStackRef.current.length > MAX_HISTORY) {
      undoStackRef.current.shift()
    }
    redoStackRef.current = []
    syncUndoRedoCounts()
  }, [captureSnapshot, syncUndoRedoCounts])

  const handleUndoAlignment = useCallback(() => {
    if (isApplyingUndoRedoRef.current) return
    const previousSnapshot = undoStackRef.current.pop()
    if (!previousSnapshot) return

    redoStackRef.current.push(captureSnapshot())
    if (redoStackRef.current.length > MAX_HISTORY) {
      redoStackRef.current.shift()
    }

    restoreSnapshot(previousSnapshot)
    syncUndoRedoCounts()
  }, [captureSnapshot, restoreSnapshot, syncUndoRedoCounts])

  const handleRedoAlignment = useCallback(() => {
    if (isApplyingUndoRedoRef.current) return
    const nextSnapshot = redoStackRef.current.pop()
    if (!nextSnapshot) return

    undoStackRef.current.push(captureSnapshot())
    if (undoStackRef.current.length > MAX_HISTORY) {
      undoStackRef.current.shift()
    }

    restoreSnapshot(nextSnapshot)
    syncUndoRedoCounts()
  }, [captureSnapshot, restoreSnapshot, syncUndoRedoCounts])

  return {
    undoCount,
    redoCount,
    pushUndoSnapshot,
    handleUndoAlignment,
    handleRedoAlignment,
  }
}
