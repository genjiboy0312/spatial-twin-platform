import { useMemo } from 'react'
import type { GpsAlignmentLocalPoints, PickMode } from '../types'

type AnchorTuple = [number, number, number]
type AnchorSet = { origin: AnchorTuple | null; point1: AnchorTuple | null; point2: AnchorTuple | null }

type AnchorMarker = {
  point: AnchorTuple
  label: string
  kind: 'model' | 'cloud' | 'gps-origin'
}

type ViewerPickedPoint = {
  id: number
  point: AnchorTuple
  source?: '2d' | '3d'
}

type AlignedObjectGpsMarker = {
  point?: AnchorTuple
  label?: string
  kind?: AnchorMarker['kind']
}

interface UseAlignmentPickAnchorMarkersArgs {
  alignmentMethod: 'osm' | 'pointcloud'
  alignLocalPoints: GpsAlignmentLocalPoints
  icpModelPoints: AnchorSet
  selectedIcpCloudAnchors: AnchorSet
  showPointCloudPickLabels: boolean
  pickMode: PickMode
  viewerPickedPoint: ViewerPickedPoint | null
  transformedGps: { lat: number; lng: number } | null
  alignedObjectGpsMarkers: AlignedObjectGpsMarker[]
  showAlignedGpsBillboardText: boolean
}

function clonePoint(point: AnchorTuple): AnchorTuple {
  return [point[0], point[1], point[2]]
}

export function useAlignmentPickAnchorMarkers({
  alignmentMethod,
  alignLocalPoints,
  icpModelPoints,
  selectedIcpCloudAnchors,
  showPointCloudPickLabels,
  pickMode,
  viewerPickedPoint,
  transformedGps,
  alignedObjectGpsMarkers,
  showAlignedGpsBillboardText,
}: UseAlignmentPickAnchorMarkersArgs): AnchorMarker[] {
  return useMemo(() => {
    const markers: AnchorMarker[] = []

    const addMarker = (point: AnchorTuple | null, label: string, kind: AnchorMarker['kind']) => {
      if (!point) return
      markers.push({ point: clonePoint(point), label, kind })
    }

    if (alignmentMethod === 'pointcloud') {
      addMarker(icpModelPoints.origin, 'model-origin', 'model')
      addMarker(icpModelPoints.point1, 'model-point1', 'model')
      addMarker(icpModelPoints.point2, 'model-point2', 'model')
      addMarker(selectedIcpCloudAnchors.origin, showPointCloudPickLabels ? 'pc-origin' : 'cloud-origin', 'cloud')
      addMarker(selectedIcpCloudAnchors.point1, showPointCloudPickLabels ? 'pc-point1' : 'cloud-point1', 'cloud')
      addMarker(selectedIcpCloudAnchors.point2, showPointCloudPickLabels ? 'pc-point2' : 'cloud-point2', 'cloud')
    } else {
      addMarker(alignLocalPoints.origin, 'gps-origin', 'gps-origin')
      addMarker(alignLocalPoints.point1, 'pick-point1', 'model')
      addMarker(alignLocalPoints.point2, 'pick-point2', 'model')

      if (pickMode === 'display' && alignLocalPoints.display) {
        const label = transformedGps
          ? `pick-display | lat ${transformedGps.lat.toFixed(7)} / lng ${transformedGps.lng.toFixed(7)}`
          : 'pick-display'
        addMarker(alignLocalPoints.display, label, 'model')
      }

      if (showAlignedGpsBillboardText) {
        for (const marker of alignedObjectGpsMarkers) {
          if (marker.point) {
            addMarker(marker.point, marker.label ?? 'aligned-gps', marker.kind ?? 'gps-origin')
          }
        }
      }
    }

    if (markers.length === 0 && viewerPickedPoint && pickMode !== 'none') {
      markers.push({
        point: clonePoint(viewerPickedPoint.point),
        label: `pick-${viewerPickedPoint.id}`,
        kind: alignmentMethod === 'pointcloud' ? 'cloud' : 'model',
      })
    }

    return markers
  }, [
    alignedObjectGpsMarkers,
    alignLocalPoints.display,
    alignLocalPoints.origin,
    alignLocalPoints.point1,
    alignLocalPoints.point2,
    alignmentMethod,
    icpModelPoints.origin,
    icpModelPoints.point1,
    icpModelPoints.point2,
    pickMode,
    selectedIcpCloudAnchors.origin,
    selectedIcpCloudAnchors.point1,
    selectedIcpCloudAnchors.point2,
    showAlignedGpsBillboardText,
    showPointCloudPickLabels,
    transformedGps,
    viewerPickedPoint,
  ])
}
