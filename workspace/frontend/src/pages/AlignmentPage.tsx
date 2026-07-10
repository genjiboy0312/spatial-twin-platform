import { useCallback, useEffect, useRef, useState } from 'react'

import { getProjectSnapshot, saveProjectSnapshotSection } from '../api/projectData'
import { usePreferences } from '../app/preferences'
import { PageHeader } from './PageHeader'
import { AlignmentCenterViewerPanel } from './alignment/components/AlignmentCenterViewerPanel'
import { AlignmentLeftPanel } from './alignment/components/AlignmentLeftPanel'
import { AlignmentWorkflowPanel } from './alignment/components/AlignmentWorkflowPanel'
import { OSMAlignmentPanel } from './alignment/components/OSMAlignmentPanel'
import { AlignmentProvider } from './alignment/context/AlignmentContext'
import { useAlignmentDoAlign } from './alignment/hooks/useAlignmentDoAlign'
import { useAlignmentHistory } from './alignment/hooks/useAlignmentHistory'
import { useAlignmentPage } from './alignment/hooks/useAlignmentPage'
import { useAlignmentPickAnchorMarkers } from './alignment/hooks/useAlignmentPickAnchorMarkers'
import type { AnchorTuple } from './alignment/hooks/useAlignmentPage.types'
import type { GpsAlignmentInputs, GpsAlignmentLocalPoints, PickMode } from './alignment/types'

const pageCopy = {
  ko: {
    eyebrow: 'Step 4',
    title: 'GPS 정합',
    description: 'OSM 지도 기준점과 3점 정합을 이용해 업로드 모델의 실제 GPS 위치를 맞춥니다.',
    pointCloudReadyTitle: 'PointCloud 정합',
    pointCloudReadyBody: 'PointCloud + OSM 정합 패널은 포인트클라우드 업로드/앵커 선택 흐름과 연결될 예정입니다.',
  },
  en: {
    eyebrow: 'Step 4',
    title: 'GPS Alignment',
    description: 'Align uploaded models to real GPS coordinates using OSM reference points and 3-point matching.',
    pointCloudReadyTitle: 'PointCloud Alignment',
    pointCloudReadyBody: 'The PointCloud + OSM alignment panel will connect to uploaded clouds and cloud anchor selection.',
  },
} as const

type Language = keyof typeof pageCopy
type AlignmentSaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

const emptyAnchorSet = { origin: null, point1: null, point2: null }

function isAlignmentSnapshot(value: unknown): value is {
  selectedFloorId?: number | null
  alignmentMethod?: 'osm' | 'pointcloud'
  cameraViewMode?: 'top' | 'perspective'
  buildingOrigin?: [number, number] | null
  quadOriginInput?: { lat: string; lng: string }
  osmQuadZoom?: number
  osmQuadScale?: number
  osmQuadOpacity?: number
  pickMode?: PickMode
  alignLocalPoints?: GpsAlignmentLocalPoints
  alignGpsInputs?: GpsAlignmentInputs
  alignmentMatrix?: number[][] | null
  alignmentRmse?: number | null
  transformedGps?: { lat: number; lng: number } | null
  showAlignedGpsBillboardText?: boolean
  hasJustAligned?: boolean
} {
  return typeof value === 'object' && value !== null
}

function alignmentSaveLabel(status: AlignmentSaveStatus, language: Language) {
  const labels = {
    ko: {
      idle: '정합 동기화 준비',
      loading: '정합 상태 불러오는 중...',
      saving: '정합 상태 저장 중...',
      saved: '정합 상태 저장됨',
      error: '정합 저장 실패',
    },
    en: {
      idle: 'Alignment sync ready',
      loading: 'Loading alignment state...',
      saving: 'Saving alignment state...',
      saved: 'Alignment state saved',
      error: 'Alignment save failed',
    },
  } as const
  return labels[language][status]
}

export function AlignmentPage() {
  const { language } = usePreferences()
  const labels = pageCopy[language as Language] ?? pageCopy.ko
  const {
    viewMode,
    currentBuilding,
    floors,
    alignmentMethod,
    setAlignmentMethod,
    selectedFloorId,
    selectedFloor,
    buildingOrigin,
    setBuildingOrigin,
    quadOriginInput,
    setQuadOriginInput,
    quadOriginInputError,
    applyQuadOriginInput,
    resetQuadOriginToDefault,
    osmQuadZoom,
    setOsmQuadZoom,
    osmQuadScale,
    setOsmQuadScale,
    osmQuadOpacity,
    setOsmQuadOpacity,
    viewerPickedPoint,
    handleFloorSelect,
    handleViewerPointPicked,
    goToProjects,
  } = useAlignmentPage()

  const [cameraViewMode, setCameraViewMode] = useState<'top' | 'perspective'>('perspective')
  const [pickMode, setPickMode] = useState<PickMode>('none')
  const [alignLocalPoints, setAlignLocalPoints] = useState<GpsAlignmentLocalPoints>({
    origin: null,
    point1: null,
    point2: null,
    display: null,
  })
  const [alignGpsInputs, setAlignGpsInputs] = useState<GpsAlignmentInputs>({
    originLat: '',
    originLng: '',
    point1Lat: '',
    point1Lng: '',
    point2Lat: '',
    point2Lng: '',
  })
  const [alignmentMatrix, setAlignmentMatrix] = useState<number[][] | null>(null)
  const [alignmentRmse, setAlignmentRmse] = useState<number | null>(null)
  const [alignmentError, setAlignmentError] = useState<string | null>(null)
  const [transformedGps, setTransformedGps] = useState<{ lat: number; lng: number } | null>(null)
  const [showAlignedGpsBillboardText, setShowAlignedGpsBillboardText] = useState(true)
  const [hasJustAligned, setHasJustAligned] = useState(false)
  const [alignmentHydrated, setAlignmentHydrated] = useState(false)
  const [saveStatus, setSaveStatus] = useState<AlignmentSaveStatus>('idle')
  const autosaveTimerRef = useRef<number | null>(null)

  const {
    undoCount,
    redoCount,
    pushUndoSnapshot,
    handleUndoAlignment,
    handleRedoAlignment,
  } = useAlignmentHistory({
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
  })

  const { handleDoAlign, handleOsmHoverPick } = useAlignmentDoAlign({
    currentBuildingId: currentBuilding?.id ?? null,
    alignLocalPoints,
    setAlignLocalPoints,
    alignGpsInputs,
    setAlignmentError,
    setAlignmentMatrix,
    setAlignmentRmse,
    setTransformedGps,
    setPickMode,
    pushUndoSnapshot,
    clearAlignedMarkers: () => undefined,
    pickMode,
    alignmentMatrix,
    onHoverGpsPicked: setTransformedGps,
    onAlignSuccess: () => setHasJustAligned(true),
  })

  const pickAnchorMarkers = useAlignmentPickAnchorMarkers({
    alignmentMethod,
    alignLocalPoints,
    icpModelPoints: emptyAnchorSet,
    selectedIcpCloudAnchors: emptyAnchorSet,
    showPointCloudPickLabels: false,
    pickMode,
    viewerPickedPoint,
    transformedGps,
    alignedObjectGpsMarkers: [],
    showAlignedGpsBillboardText,
  })

  const handleFloorSelectWithSpatial = useCallback(
    async (floorId: number) => {
      handleFloorSelect(floorId)
    },
    [handleFloorSelect],
  )

  const handleSceneAnchorPick = useCallback(
    (localPoint: AnchorTuple, source: '2d' | '3d') => {
      handleViewerPointPicked(localPoint, source)
      if (pickMode === 'none') return
      setAlignLocalPoints((prev) => ({ ...prev, [pickMode]: localPoint }))
      setPickMode('none')
    },
    [handleViewerPointPicked, pickMode],
  )

  const handleOsmPick = useCallback(
    (gps: [number, number], localPoint: AnchorTuple) => {
      if (pickMode === 'none' || pickMode === 'display') {
        if (pickMode === 'display') handleOsmHoverPick(gps, localPoint)
        return
      }

      const inputKeys: Record<Exclude<PickMode, 'none' | 'display'>, [keyof GpsAlignmentInputs, keyof GpsAlignmentInputs]> = {
        origin: ['originLat', 'originLng'],
        point1: ['point1Lat', 'point1Lng'],
        point2: ['point2Lat', 'point2Lng'],
      }
      const [latKey, lngKey] = inputKeys[pickMode]
      setAlignGpsInputs((prev) => ({
        ...prev,
        [latKey]: String(gps[0]),
        [lngKey]: String(gps[1]),
      }))
      setAlignLocalPoints((prev) => ({ ...prev, [pickMode]: localPoint }))
      setPickMode('none')
    },
    [handleOsmHoverPick, pickMode],
  )

  useEffect(() => {
    if (!currentBuilding) {
      setAlignmentHydrated(false)
      return
    }

    let cancelled = false
    setSaveStatus('loading')
    getProjectSnapshot(currentBuilding.id)
      .then((snapshot) => {
        if (cancelled) return
        const alignmentSnapshot = snapshot.state.alignment
        if (snapshot.saved && isAlignmentSnapshot(alignmentSnapshot)) {
          if (alignmentSnapshot.alignmentMethod) setAlignmentMethod(alignmentSnapshot.alignmentMethod)
          if (alignmentSnapshot.cameraViewMode) setCameraViewMode(alignmentSnapshot.cameraViewMode)
          if (alignmentSnapshot.buildingOrigin !== undefined) setBuildingOrigin(alignmentSnapshot.buildingOrigin)
          if (alignmentSnapshot.quadOriginInput) setQuadOriginInput(alignmentSnapshot.quadOriginInput)
          if (typeof alignmentSnapshot.osmQuadZoom === 'number') setOsmQuadZoom(alignmentSnapshot.osmQuadZoom)
          if (typeof alignmentSnapshot.osmQuadScale === 'number') setOsmQuadScale(alignmentSnapshot.osmQuadScale)
          if (typeof alignmentSnapshot.osmQuadOpacity === 'number') setOsmQuadOpacity(alignmentSnapshot.osmQuadOpacity)
          if (alignmentSnapshot.pickMode) setPickMode(alignmentSnapshot.pickMode)
          if (alignmentSnapshot.alignLocalPoints) setAlignLocalPoints(alignmentSnapshot.alignLocalPoints)
          if (alignmentSnapshot.alignGpsInputs) setAlignGpsInputs(alignmentSnapshot.alignGpsInputs)
          if (alignmentSnapshot.alignmentMatrix !== undefined) setAlignmentMatrix(alignmentSnapshot.alignmentMatrix)
          if (alignmentSnapshot.alignmentRmse !== undefined) setAlignmentRmse(alignmentSnapshot.alignmentRmse)
          if (alignmentSnapshot.transformedGps !== undefined) setTransformedGps(alignmentSnapshot.transformedGps)
          if (typeof alignmentSnapshot.showAlignedGpsBillboardText === 'boolean') {
            setShowAlignedGpsBillboardText(alignmentSnapshot.showAlignedGpsBillboardText)
          }
          if (typeof alignmentSnapshot.hasJustAligned === 'boolean') setHasJustAligned(alignmentSnapshot.hasJustAligned)
          if (alignmentSnapshot.selectedFloorId) handleFloorSelect(alignmentSnapshot.selectedFloorId)
        }
        setAlignmentHydrated(true)
        setSaveStatus(snapshot.saved ? 'saved' : 'idle')
      })
      .catch(() => {
        if (cancelled) return
        setAlignmentHydrated(true)
        setSaveStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [
    currentBuilding,
    handleFloorSelect,
    setAlignmentMethod,
    setBuildingOrigin,
    setOsmQuadOpacity,
    setOsmQuadScale,
    setOsmQuadZoom,
    setQuadOriginInput,
  ])

  useEffect(() => {
    if (!currentBuilding || !alignmentHydrated) return undefined
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = window.setTimeout(() => {
      setSaveStatus('saving')
      saveProjectSnapshotSection(currentBuilding.id, 'alignment', {
        selectedFloorId,
        alignmentMethod,
        cameraViewMode,
        buildingOrigin,
        quadOriginInput,
        osmQuadZoom,
        osmQuadScale,
        osmQuadOpacity,
        pickMode,
        alignLocalPoints,
        alignGpsInputs,
        alignmentMatrix,
        alignmentRmse,
        transformedGps,
        showAlignedGpsBillboardText,
        hasJustAligned,
        updatedAt: new Date().toISOString(),
      })
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'))
    }, 900)
    return () => {
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current)
    }
  }, [
    alignGpsInputs,
    alignLocalPoints,
    alignmentHydrated,
    alignmentMatrix,
    alignmentMethod,
    alignmentRmse,
    buildingOrigin,
    cameraViewMode,
    currentBuilding,
    hasJustAligned,
    osmQuadOpacity,
    osmQuadScale,
    osmQuadZoom,
    pickMode,
    quadOriginInput,
    selectedFloorId,
    showAlignedGpsBillboardText,
    transformedGps,
  ])

  const providerValue = {
    currentBuilding: currentBuilding ? { id: currentBuilding.id, name: currentBuilding.name } : null,
    selectedFloorId,
    selectedFloor: selectedFloor
      ? { id: selectedFloor.id, floor_number: selectedFloor.floor_number, floor_name: selectedFloor.floor_name }
      : null,
    alignmentMethod,
    setAlignmentMethod,
    buildingOrigin,
    setBuildingOrigin: (origin: [number, number]) => setBuildingOrigin(origin),
    quadOriginInput,
    setQuadOriginInput,
    osmQuadZoom,
    setOsmQuadZoom,
    osmQuadScale,
    setOsmQuadScale,
    osmQuadOpacity,
    setOsmQuadOpacity,
    applyQuadOriginInput,
    resetQuadOriginToDefault,
    quadOriginInputError,
    onDoAlign: handleDoAlign,
    pickMode,
    setPickMode,
    alignLocalPoints,
    setAlignLocalPoints,
    alignGpsInputs,
    setAlignGpsInputs,
    alignmentMatrix,
    setAlignmentMatrix,
    alignmentRmse,
    setAlignmentRmse,
    alignmentError,
    setAlignmentError,
    transformedGps,
    setTransformedGps,
    showAlignedGpsBillboardText,
    setShowAlignedGpsBillboardText,
    hasJustAligned,
    setHasJustAligned,
  }

  return (
    <section className="page-grid spatial-page alignment-reference-page">
      <PageHeader eyebrow={labels.eyebrow} title={labels.title} description={labels.description} />
      <div className={`alignment-autosave-pill ${saveStatus}`}>
        {alignmentSaveLabel(saveStatus, language as Language)}
      </div>

      <AlignmentProvider {...providerValue}>
        <div className="alignment-reference-stage">
          <AlignmentLeftPanel
            alignmentMethod={alignmentMethod}
            setAlignmentMethod={setAlignmentMethod}
            floors={floors}
            selectedFloorId={selectedFloorId}
            handleFloorSelectWithSpatial={handleFloorSelectWithSpatial}
            goToProjects={goToProjects}
            cameraViewMode={cameraViewMode}
            setCameraViewMode={setCameraViewMode}
            buildingOrigin={buildingOrigin}
            hasOsmData={buildingOrigin !== null}
            hasPointCloudData={false}
            language={language}
          />

          <AlignmentCenterViewerPanel
            selectedFloor={selectedFloor}
            selectedFloorId={selectedFloorId}
            alignmentMethod={alignmentMethod}
            cameraViewMode={cameraViewMode}
            viewMode={viewMode}
            buildingOrigin={buildingOrigin}
            osmQuadZoom={osmQuadZoom}
            osmQuadOpacity={osmQuadOpacity}
            handleSceneAnchorPick={handleSceneAnchorPick}
            pickAnchorMarkers={pickAnchorMarkers}
            handleOsmPick={handleOsmPick}
            handleOsmHoverPick={handleOsmHoverPick}
            pickMode={pickMode}
            language={language}
          />

          <AlignmentWorkflowPanel
            alignmentMethod={alignmentMethod}
            language={language}
            undoCount={undoCount}
            redoCount={redoCount}
            onUndo={handleUndoAlignment}
            onRedo={handleRedoAlignment}
          >
            {alignmentMethod === 'osm' ? (
              <OSMAlignmentPanel language={language} />
            ) : (
              <div className="ap-step-content">
                <div className="ap-status-card warning">
                  <strong>{labels.pointCloudReadyTitle}</strong>
                  <span>{labels.pointCloudReadyBody}</span>
                </div>
              </div>
            )}
          </AlignmentWorkflowPanel>
        </div>
      </AlignmentProvider>
    </section>
  )
}
