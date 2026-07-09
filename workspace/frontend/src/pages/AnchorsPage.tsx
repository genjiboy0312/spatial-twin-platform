import { useCallback, useMemo, useState } from 'react'

import { usePreferences } from '../app/preferences'
import { sendJson } from '../api/client'
import { OsmTileMapPanel, type OsmMapMarker } from '../components/OsmTileMapPanel'
import { useAlignmentStore } from '../stores/alignmentStore'
import type { AnchorPoint, AlignmentResult } from '../utils/alignmentUtils'
import { PageHeader } from './PageHeader'

type StepId = 1 | 2 | 3
type PickTarget = 'origin' | 'point1' | 'point2'
type LatLngTuple = [number, number]
type Tone = 'neutral' | 'success' | 'primary' | 'warning' | 'danger'

type ApiAlignmentResult = {
  rmse?: number
  transform_matrix?: number[][]
}

type TransformPointResult = {
  gps_point?: [number, number]
}

const WORKSPACE_BUILDING_ID = 1
const pickTargets: PickTarget[] = ['origin', 'point1', 'point2']
const targetIndexes: Record<PickTarget, number> = { origin: 0, point1: 1, point2: 2 }
const localDefaults: Record<PickTarget, { x: number; y: number }> = {
  origin: { x: 0, y: 0 },
  point1: { x: 42, y: 0 },
  point2: { x: 0, y: 30 },
}

const STEP_STYLES = `
@keyframes anchors-step-enter {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes anchors-pulse-glow {
  0%, 100% { box-shadow: 0 0 0 rgba(228, 228, 231, 0); }
  50% { box-shadow: 0 0 24px rgba(228, 228, 231, 0.24); }
}
@keyframes anchors-soft-sweep {
  from { transform: translateX(-40%); opacity: 0; }
  45% { opacity: 1; }
  to { transform: translateX(40%); opacity: 0; }
}
.anchors-step-shell { display: grid; gap: 16px; }
.anchors-step-progress { position: relative; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: linear-gradient(180deg, rgba(24, 24, 27, 0.94), rgba(12, 12, 13, 0.94)); box-shadow: 0 16px 52px rgba(0, 0, 0, 0.22); padding: 16px; }
:root[data-theme="light"] .anchors-step-progress { background: #ffffff; box-shadow: 0 16px 42px rgba(24, 24, 27, 0.08); }
.anchors-step-progress::before { content: ""; position: absolute; left: 24px; right: 24px; top: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--accent), transparent); animation: anchors-soft-sweep 4.5s ease-in-out infinite; }
.anchors-step-track { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.anchors-step-node { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: center; min-width: 0; color: var(--muted); }
.anchors-step-node:not(:last-child)::after { content: ""; grid-column: 1 / -1; height: 2px; margin-left: 44px; margin-top: -18px; background: rgba(63, 63, 70, 0.7); border-radius: 999px; }
.anchors-step-node.complete:not(:last-child)::after { background: linear-gradient(90deg, #22c55e, rgba(34, 197, 94, 0.22)); }
.anchors-step-index { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid var(--border); border-radius: 999px; background: rgba(39, 39, 42, 0.72); color: var(--muted); font-size: 0.78rem; font-weight: 1000; }
.anchors-step-node.active .anchors-step-index { border-color: rgba(228, 228, 231, 0.52); background: #e4e4e7; color: #09090b; animation: anchors-pulse-glow 2.4s ease-in-out infinite; }
.anchors-step-node.complete .anchors-step-index { border-color: rgba(34, 197, 94, 0.38); background: rgba(34, 197, 94, 0.18); color: #86efac; }
.anchors-step-copy { display: grid; gap: 2px; min-width: 0; }
.anchors-step-copy strong { overflow: hidden; color: var(--text); font-size: 0.82rem; text-overflow: ellipsis; white-space: nowrap; }
.anchors-step-copy small { overflow: hidden; color: var(--dim); font-size: 0.68rem; font-weight: 800; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
.anchors-step-content { display: grid; gap: 14px; padding: 16px; animation: anchors-step-enter 0.35s ease-out; }
.anchors-section-card { display: grid; gap: 10px; border: 1px solid var(--border); border-radius: 11px; background: rgba(24, 24, 27, 0.58); padding: 14px; }
:root[data-theme="light"] .anchors-section-card { background: #f4f4f5; }
.anchors-section-card.success { border-color: rgba(34, 197, 94, 0.28); background: rgba(34, 197, 94, 0.08); }
.anchors-section-card.warning { border-color: rgba(234, 179, 8, 0.3); background: rgba(234, 179, 8, 0.08); }
.anchors-section-card.danger { border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08); }
.anchors-section-card p { margin: 0; color: var(--muted); line-height: 1.55; }
.anchors-section-card strong { color: var(--text); }
.anchors-metric-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.anchors-metric-tile { border: 1px solid var(--border); border-radius: 10px; background: rgba(9, 9, 11, 0.42); padding: 11px; }
:root[data-theme="light"] .anchors-metric-tile { background: #ffffff; }
.anchors-metric-tile span { display: block; color: var(--dim); font-size: 0.68rem; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
.anchors-metric-tile strong { display: block; margin-top: 5px; color: var(--text); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.88rem; }
.anchors-metric-tile.success strong { color: #86efac; }
.anchors-metric-tile.primary strong { color: #bfdbfe; }
.anchors-metric-tile.warning strong { color: #facc15; }
.anchors-metric-tile.danger strong { color: #f87171; }
.anchors-substep-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.anchors-substep-badge { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--border); border-radius: 10px; background: rgba(39, 39, 42, 0.58); color: var(--muted); padding: 9px 8px; font-size: 0.72rem; font-weight: 900; }
.anchors-substep-badge.ready { border-color: rgba(34, 197, 94, 0.3); background: rgba(34, 197, 94, 0.12); color: #86efac; }
.anchors-pick-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.anchors-pick-button { border: 1px solid var(--border); border-radius: 10px; background: rgba(39, 39, 42, 0.58); color: var(--muted); cursor: pointer; padding: 11px 12px; text-align: left; transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s; }
.anchors-pick-button:hover:not(:disabled), .anchors-pick-button.active { border-color: rgba(228, 228, 231, 0.42); background: rgba(228, 228, 231, 0.12); color: var(--text); transform: translateY(-1px); }
.anchors-pick-button.ready { border-color: rgba(34, 197, 94, 0.28); color: #86efac; }
.anchors-pick-button span { display: block; margin-top: 3px; color: var(--dim); font-size: 0.68rem; font-weight: 800; }
.anchors-position-stack { display: grid; gap: 8px; }
.anchors-position-card { display: grid; gap: 5px; border: 1px solid var(--border); border-radius: 10px; background: rgba(24, 24, 27, 0.52); padding: 10px 12px; }
:root[data-theme="light"] .anchors-position-card { background: #ffffff; }
.anchors-position-card.ready { border-color: rgba(34, 197, 94, 0.28); }
.anchors-position-card header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.anchors-position-card span { color: var(--muted); font-size: 0.76rem; font-weight: 800; }
.anchors-position-card em { color: var(--dim); font-size: 0.68rem; font-style: normal; font-weight: 900; }
.anchors-position-card.ready em { color: #86efac; }
.anchors-position-card p { margin: 0; color: var(--text); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.78rem; }
.anchors-action-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
.anchors-message { border: 1px solid var(--border); border-radius: 10px; color: var(--muted); padding: 10px 12px; font-size: 0.82rem; line-height: 1.5; }
.anchors-message.success { border-color: rgba(34, 197, 94, 0.3); background: rgba(34, 197, 94, 0.1); color: #86efac; }
.anchors-message.danger { border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.1); color: #fca5a5; }
.anchors-workflow-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid var(--border); padding: 14px 16px; }
.anchors-workflow-footer small { color: var(--dim); font-weight: 800; }
@media (max-width: 960px) {
  .anchors-map-layout { grid-template-columns: 1fr; }
  .anchors-step-track, .anchors-substep-grid, .anchors-pick-grid, .anchors-metric-grid { grid-template-columns: 1fr; }
  .anchors-step-node:not(:last-child)::after { display: none; }
}
`

const copy = {
  en: {
    eyebrow: 'Anchor / Map',
    title: 'Anchor & Map Integration',
    description: 'From OSM reference points through 3-point alignment to building origin application — all managed in one screen.',
    mapPanel: 'OSM Tile Map',
    mapTitle: 'Reference map and coordinate pick',
    mapInstruction: 'Choose a workflow target, then click the OSM map to save its GPS coordinate. Right-drag pans and wheel zooms.',
    mapReadOnlyInstruction: 'Alignment is applied. The map is read-only; restart to pick new reference points.',
    picked: 'Picked coordinate',
    pickedPlaceholder: 'No map coordinate selected yet.',
    workflow: 'Workflow',
    anchors: 'Anchor Points',
    summary: 'Alignment Summary',
    label: 'Label',
    local: 'Local',
    gps: 'GPS',
    id: 'ID',
    notSet: 'GPS not set',
    noAnchors: 'No anchors yet',
    emptyBody: 'Start with Set Reference or pick Origin, Point 1, and Point 2 on the map.',
    previous: 'Previous',
    next: 'Next',
    finish: 'Transform / Save',
    currentStep: 'Current step',
    setReference: 'Set Reference',
    clear: 'Clear Anchors',
    compute: 'Compute Alignment',
    computing: 'Computing...',
    apply: 'Apply Alignment',
    applying: 'Applying...',
    restart: 'Reset / Restart',
    ready: 'Ready',
    waiting: 'Waiting',
    set: 'Set',
    unset: 'Unset',
    apiSynced: 'API compute completed and the local alignment summary is updated.',
    localComputed: 'Local alignment computed. API sync was unavailable, so the store result is being used.',
    applyComplete: 'Alignment applied to the current workspace state.',
    applyApiComplete: 'Alignment applied locally and origin transform was confirmed by the GPS alignment API.',
    pointsNeeded: 'Pick all three GPS points before computing.',
    steps: {
      reference: { label: 'Reference Point', description: 'Set OSM reference' },
      threePoint: { label: '3-Point Alignment', description: 'Origin / Point 1 / Point 2' },
      transform: { label: 'Transform / Save', description: 'Apply building origin' },
    },
    targets: { origin: 'Origin', point1: 'Point 1', point2: 'Point 2' },
    step1: {
      title: 'Set GPS reference',
      subtitle: 'Use the existing OSM map panel to seed or inspect anchor coordinates.',
      statusLabel: 'GPS origin status',
      statusSet: 'Reference origin is set',
      statusUnset: 'Reference origin is not set',
      instruction: 'Click Set Reference, then choose a point on the map. This saves the Origin anchor at local 0,0.',
      mode: 'Input Mode',
      modeValue: 'OSM map pick',
      anchorCount: 'Anchors',
      gpsCount: 'GPS-ready',
    },
    step2: {
      title: '3-point alignment',
      subtitle: 'Pick Origin, Point 1, and Point 2, then compute the transform.',
      calculate: 'Calculate',
      pickButton: 'Pick on map',
      gpsWaiting: 'Waiting for map pick',
      readiness: 'Readiness',
      rmse: 'RMSE',
      exact: 'Exact match',
      calculated: 'Calculated',
      apiRmse: 'API RMSE',
    },
    step3: {
      title: 'Apply and save',
      subtitle: 'Review the final origin and alignment metrics.',
      applied: 'Applied',
      awaiting: 'Awaiting apply',
      appliedOrigin: 'Applied origin',
      transformStatus: 'Transform status',
      metrics: 'Metrics',
    },
  },
  ko: {
    eyebrow: 'Anchor / Map',
    title: 'Anchor & Map 통합',
    description: 'OSM 기준점부터 3점 정합, 건물 원점 적용까지 한 화면에서 관리합니다.',
    mapPanel: 'OSM Tile Map',
    mapTitle: '기준 지도 및 좌표 선택',
    mapInstruction: '워크플로우 대상을 선택한 뒤 OSM 지도를 클릭해 GPS 좌표를 저장하세요. 우클릭 드래그로 이동하고 휠로 확대/축소합니다.',
    mapReadOnlyInstruction: '정합이 적용되었습니다. 새 기준점을 찍으려면 다시 시작하세요.',
    picked: '선택 좌표',
    pickedPlaceholder: '아직 지도에서 선택한 좌표가 없습니다.',
    workflow: '워크플로우',
    anchors: '기준점 목록',
    summary: '정합 요약',
    label: '라벨',
    local: '로컬',
    gps: 'GPS',
    id: 'ID',
    notSet: 'GPS 미설정',
    noAnchors: '아직 기준점 없음',
    emptyBody: '기준점 설정 또는 Origin, Point 1, Point 2 지도 선택으로 시작하세요.',
    previous: '이전',
    next: '다음',
    finish: '변환 / 저장',
    currentStep: '현재 단계',
    setReference: '기준점 설정',
    clear: '기준점 초기화',
    compute: '정합 계산',
    computing: '계산 중...',
    apply: '정합 적용',
    applying: '적용 중...',
    restart: '초기화 / 다시 시작',
    ready: '완료',
    waiting: '대기',
    set: '설정됨',
    unset: '미설정',
    apiSynced: 'API 정합 계산이 완료되었고 로컬 정합 요약도 업데이트되었습니다.',
    localComputed: '로컬 정합 계산을 완료했습니다. API 연결은 사용할 수 없어 스토어 결과를 사용합니다.',
    applyComplete: '현재 워크스페이스 상태에 정합을 적용했습니다.',
    applyApiComplete: '로컬 정합 적용과 GPS 정합 API 원점 변환 확인이 완료되었습니다.',
    pointsNeeded: '계산 전에 세 GPS 기준점을 모두 선택하세요.',
    steps: {
      reference: { label: '기준점', description: 'OSM 기준 위치 설정' },
      threePoint: { label: '3점 정합', description: 'Origin / Point 1 / Point 2' },
      transform: { label: '변환 / 저장', description: '건물 원점 적용' },
    },
    targets: { origin: 'Origin', point1: 'Point 1', point2: 'Point 2' },
    step1: {
      title: 'GPS 기준점 설정',
      subtitle: '기존 OSM 지도 패널로 기준점 좌표를 입력하고 검토합니다.',
      statusLabel: 'GPS 원점 상태',
      statusSet: '기준 원점이 설정되었습니다',
      statusUnset: '기준 원점이 아직 없습니다',
      instruction: '기준점 설정을 누른 뒤 지도에서 지점을 선택하세요. local 0,0의 Origin 기준점으로 저장됩니다.',
      mode: '입력 방식',
      modeValue: 'OSM 지도 선택',
      anchorCount: '기준점',
      gpsCount: 'GPS 완료',
    },
    step2: {
      title: '3점 정합',
      subtitle: 'Origin, Point 1, Point 2를 선택한 뒤 변환을 계산합니다.',
      calculate: '계산',
      pickButton: '지도에서 선택',
      gpsWaiting: '지도 선택 대기 중',
      readiness: '준비 상태',
      rmse: 'RMSE',
      exact: '정확히 일치',
      calculated: '계산 완료',
      apiRmse: 'API RMSE',
    },
    step3: {
      title: '적용 및 저장',
      subtitle: '최종 원점과 정합 지표를 확인합니다.',
      applied: '적용됨',
      awaiting: '적용 대기',
      appliedOrigin: '적용 원점',
      transformStatus: '변환 상태',
      metrics: '지표',
    },
  },
} as const

const gpsAlignmentApi = {
  computeThreePointAlignment(buildingId: number, points: Array<{ local: [number, number]; gps: [number, number] }>) {
    return sendJson<ApiAlignmentResult, { building_id: number; points: Array<{ local: [number, number]; gps: [number, number] }> }>(
      '/api/gps-alignment/three-point',
      'POST',
      { building_id: buildingId, points },
    )
  },
  transformPoint(buildingId: number, localPoint: [number, number], transformMatrix: number[][]) {
    return sendJson<TransformPointResult, { building_id: number; local_point: [number, number]; transform_matrix: number[][] }>(
      '/api/gps-alignment/transform-point',
      'POST',
      { building_id: buildingId, local_point: localPoint, transform_matrix: transformMatrix },
    )
  },
}

function hasGps(anchor: AnchorPoint | undefined) {
  return !!anchor && (anchor.longitude !== 0 || anchor.latitude !== 0)
}

function formatCoord(value: number | undefined, precision = 6) {
  return typeof value === 'number' ? value.toFixed(precision) : '—'
}

function formatGps(anchor: AnchorPoint | undefined, labels: typeof copy.en | typeof copy.ko) {
  return hasGps(anchor) ? `${formatCoord(anchor?.latitude)}, ${formatCoord(anchor?.longitude)}` : labels.notSet
}

function formatResult(result: AlignmentResult | null, labels: typeof copy.en | typeof copy.ko) {
  if (!result) return '—'
  return result.rmsErrorMeters < 1e-9 ? labels.step2.exact : `${result.rmsErrorMeters.toFixed(3)} m`
}

function metricToneClass(tone: Tone) {
  return tone === 'neutral' ? 'anchors-metric-tile' : `anchors-metric-tile ${tone}`
}

function MetricTile({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className={metricToneClass(tone)}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function StepProgress({ currentStep, completeStep1, completeStep2, labels }: { currentStep: StepId; completeStep1: boolean; completeStep2: boolean; labels: typeof copy.en | typeof copy.ko }) {
  const steps = [
    { id: 1 as StepId, label: labels.steps.reference.label, description: labels.steps.reference.description, complete: completeStep1 },
    { id: 2 as StepId, label: labels.steps.threePoint.label, description: labels.steps.threePoint.description, complete: completeStep2 },
    { id: 3 as StepId, label: labels.steps.transform.label, description: labels.steps.transform.description, complete: completeStep2 },
  ]

  return (
    <div className="anchors-step-progress" aria-label={labels.workflow}>
      <div className="anchors-step-track">
        {steps.map((step) => (
          <div key={step.id} className={`anchors-step-node${currentStep === step.id ? ' active' : ''}${step.complete ? ' complete' : ''}`}>
            <span className="anchors-step-index">{step.complete ? '✓' : step.id}</span>
            <span className="anchors-step-copy">
              <strong>{step.label}</strong>
              <small>{step.description}</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AnchorsPage() {
  const { language } = usePreferences()
  const labels = copy[language]
  const anchors = useAlignmentStore((state) => state.anchors)
  const upsertAnchorAt = useAlignmentStore((state) => state.upsertAnchorAt)
  const clearAnchors = useAlignmentStore((state) => state.clearAnchors)
  const computeStoreAlignment = useAlignmentStore((state) => state.compute)
  const applyStoreAlignment = useAlignmentStore((state) => state.applyAlignment)
  const resetAlignment = useAlignmentStore((state) => state.resetAlignment)
  const result = useAlignmentStore((state) => state.result)
  const isApplied = useAlignmentStore((state) => state.isApplied)
  const summary = useAlignmentStore((state) => state.getSummary())

  const [currentStep, setCurrentStep] = useState<StepId>(1)
  const [pickTarget, setPickTarget] = useState<PickTarget | null>(null)
  const [pickedGps, setPickedGps] = useState<LatLngTuple | null>(null)
  const [computing, setComputing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [apiRmse, setApiRmse] = useState<number | null>(null)
  const [transformMatrix, setTransformMatrix] = useState<number[][] | null>(null)
  const [appliedOrigin, setAppliedOrigin] = useState<LatLngTuple | null>(null)

  const origin = anchors[targetIndexes.origin]
  const point1 = anchors[targetIndexes.point1]
  const point2 = anchors[targetIndexes.point2]
  const readyAnchors = anchors.filter((anchor) => hasGps(anchor))
  const canCompute = hasGps(origin) && hasGps(point1) && hasGps(point2)
  const canAdvanceFromStep = currentStep === 1 ? hasGps(origin) : currentStep === 2 ? !!result || isApplied : true
  const mapCenter = (readyAnchors[0] ? [readyAnchors[0].latitude, readyAnchors[0].longitude] : undefined) as LatLngTuple | undefined

  const markers = useMemo<OsmMapMarker[]>(() => {
    const targetMarkers = pickTargets.flatMap((target) => {
      const anchor = anchors[targetIndexes[target]]
      if (!hasGps(anchor)) return []
      return [{
        id: anchor!.id,
        label: target === 'origin' ? 'O' : target === 'point1' ? '1' : '2',
        latitude: anchor!.latitude,
        longitude: anchor!.longitude,
        tone: target,
      } satisfies OsmMapMarker]
    })
    if (!appliedOrigin) return targetMarkers
    return [...targetMarkers, { id: 'applied-origin', label: 'A', latitude: appliedOrigin[0], longitude: appliedOrigin[1], tone: 'applied' }]
  }, [anchors, appliedOrigin])

  const handleMapPick = useCallback((latitude: number, longitude: number) => {
    const target = pickTarget ?? (currentStep === 1 ? 'origin' : null)
    if (!target) return
    const index = targetIndexes[target]
    const local = localDefaults[target]
    upsertAnchorAt(index, local.x, local.y, longitude, latitude, labels.targets[target])
    setPickedGps([latitude, longitude])
    setPickTarget(null)
    setStatusMessage(`${labels.targets[target]} ${labels.set}: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
    setErrorMessage(null)
    setApiRmse(null)
    setTransformMatrix(null)
    setAppliedOrigin(null)
  }, [currentStep, labels, pickTarget, upsertAnchorAt])

  const handleSetReference = () => {
    setCurrentStep(1)
    setPickTarget('origin')
    setStatusMessage(labels.step1.instruction)
    setErrorMessage(null)
  }

  const handleCompute = async () => {
    if (!canCompute || !origin || !point1 || !point2) {
      setErrorMessage(labels.pointsNeeded)
      return
    }
    setComputing(true)
    setErrorMessage(null)
    setStatusMessage(null)
    computeStoreAlignment()
    const points = [origin, point1, point2].map((anchor) => ({
      local: [anchor.localX, anchor.localY] as [number, number],
      gps: [anchor.latitude, anchor.longitude] as [number, number],
    }))
    try {
      const response = await gpsAlignmentApi.computeThreePointAlignment(WORKSPACE_BUILDING_ID, points)
      setApiRmse(typeof response.rmse === 'number' ? response.rmse : null)
      setTransformMatrix(response.transform_matrix ?? null)
      setStatusMessage(labels.apiSynced)
    } catch {
      setApiRmse(null)
      setTransformMatrix(null)
      setStatusMessage(labels.localComputed)
    } finally {
      setComputing(false)
    }
  }

  const handleApply = async () => {
    if (!result) return
    setApplying(true)
    setErrorMessage(null)
    applyStoreAlignment()
    let apiOrigin: LatLngTuple | null = null
    try {
      if (transformMatrix) {
        const response = await gpsAlignmentApi.transformPoint(WORKSPACE_BUILDING_ID, [0, 0], transformMatrix)
        if (response.gps_point) apiOrigin = [response.gps_point[0], response.gps_point[1]]
      }
      const fallbackOrigin: LatLngTuple | null = hasGps(origin) ? [origin!.latitude, origin!.longitude] : null
      setAppliedOrigin(apiOrigin ?? fallbackOrigin)
      setStatusMessage(apiOrigin ? labels.applyApiComplete : labels.applyComplete)
      setCurrentStep(3)
    } catch (caught) {
      const fallbackOrigin: LatLngTuple | null = hasGps(origin) ? [origin!.latitude, origin!.longitude] : null
      setAppliedOrigin(fallbackOrigin)
      setStatusMessage(labels.applyComplete)
      setErrorMessage(caught instanceof Error ? caught.message : null)
      setCurrentStep(3)
    } finally {
      setApplying(false)
    }
  }

  const handleRestart = () => {
    resetAlignment()
    setCurrentStep(1)
    setPickTarget(null)
    setPickedGps(null)
    setStatusMessage(null)
    setErrorMessage(null)
    setApiRmse(null)
    setTransformMatrix(null)
    setAppliedOrigin(null)
  }

  const handleClearAnchors = () => {
    clearAnchors()
    handleRestart()
  }

  return (
    <section className="page-grid anchors-map-page">
      <style>{STEP_STYLES}</style>
      <PageHeader eyebrow={labels.eyebrow} title={labels.title} description={labels.description} />

      <div className="anchors-step-shell">
        <StepProgress currentStep={currentStep} completeStep1={hasGps(origin)} completeStep2={isApplied} labels={labels} />

        <div className="anchors-map-layout">
          <main className="anchors-panel">
            <div className="spatial-card-topline" />
            <div className="anchors-panel-header">
              <div>
                <span className="eyebrow-muted">{labels.mapPanel}</span>
                <h3>{labels.mapTitle}</h3>
              </div>
              <button className="btn btn-primary" type="button" onClick={handleSetReference} disabled={isApplied}>
                {labels.setReference}
              </button>
            </div>

            <OsmTileMapPanel
              {...(mapCenter ? { center: mapCenter } : {})}
              zoom={16}
              markers={markers}
              onPick={handleMapPick}
              readOnly={isApplied || !pickTarget}
              pickLabel={pickTarget ? `${labels.targets[pickTarget]} ${labels.gps}` : labels.mapPanel}
              instruction={isApplied ? labels.mapReadOnlyInstruction : labels.mapInstruction}
            />

            <div className="anchors-step-content">
              <div className="anchors-section-card">
                <strong>{labels.picked}</strong>
                <p>{pickedGps ? `${pickedGps[0].toFixed(7)}, ${pickedGps[1].toFixed(7)}` : labels.pickedPlaceholder}</p>
              </div>
              <div className="anchors-section-card">
                <strong>{labels.summary}</strong>
                <pre className="summary-pre spatial-summary-pre">{summary}</pre>
              </div>
            </div>
          </main>

          <aside className="anchors-panel">
            <div className="spatial-card-topline muted" />
            <div className="anchors-panel-header">
              <div>
                <span className="eyebrow-muted">{labels.workflow}</span>
                <h3>{currentStep === 1 ? labels.step1.title : currentStep === 2 ? labels.step2.title : labels.step3.title}</h3>
              </div>
              <button className="btn btn-secondary" type="button" onClick={handleClearAnchors}>{labels.clear}</button>
            </div>

            {currentStep === 1 && (
              <div className="anchors-step-content" key="step-1">
                <div className={hasGps(origin) ? 'anchors-section-card success' : 'anchors-section-card warning'}>
                  <strong>{labels.step1.statusLabel}</strong>
                  <p>{hasGps(origin) ? labels.step1.statusSet : labels.step1.statusUnset}</p>
                  <div className="anchors-metric-grid">
                    <MetricTile label="Latitude" value={formatCoord(origin?.latitude, 7)} tone={hasGps(origin) ? 'success' : 'neutral'} />
                    <MetricTile label="Longitude" value={formatCoord(origin?.longitude, 7)} tone={hasGps(origin) ? 'success' : 'neutral'} />
                  </div>
                </div>

                <div className="anchors-section-card">
                  <strong>{labels.step1.subtitle}</strong>
                  <p>{labels.step1.instruction}</p>
                  <div className="anchors-metric-grid">
                    <MetricTile label={labels.step1.mode} value={labels.step1.modeValue} tone="primary" />
                    <MetricTile label={labels.step1.anchorCount} value={String(anchors.length)} />
                    <MetricTile label={labels.step1.gpsCount} value={`${readyAnchors.length}/${anchors.length || 3}`} tone={readyAnchors.length > 0 ? 'success' : 'warning'} />
                    <MetricTile label={labels.targets.origin} value={formatGps(origin, labels)} tone={hasGps(origin) ? 'success' : 'warning'} />
                  </div>
                </div>

                {anchors.length === 0 ? (
                  <div className="spatial-empty-state inset">
                    <strong>{labels.noAnchors}</strong>
                    <p>{labels.emptyBody}</p>
                  </div>
                ) : (
                  <div className="anchors-table">
                    <div className="anchors-table-row head">
                      <span>{labels.label}</span>
                      <span>{labels.local}</span>
                      <span>{labels.gps}</span>
                      <span>{labels.id}</span>
                    </div>
                    {anchors.map((anchor) => (
                      <div key={anchor.id} className="anchors-table-row">
                        <span>{anchor.label}</span>
                        <span>{anchor.localX.toFixed(2)}, {anchor.localY.toFixed(2)}</span>
                        <span>{formatGps(anchor, labels)}</span>
                        <span>{anchor.id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className="anchors-step-content" key="step-2">
                <div className="anchors-section-card">
                  <strong>{labels.step2.subtitle}</strong>
                  <div className="anchors-substep-grid">
                    {[
                      { label: labels.targets.origin, done: hasGps(origin) },
                      { label: labels.targets.point1, done: hasGps(point1) },
                      { label: labels.targets.point2, done: hasGps(point2) },
                      { label: labels.step2.calculate, done: !!result },
                    ].map((item, index) => (
                      <span key={item.label} className={item.done ? 'anchors-substep-badge ready' : 'anchors-substep-badge'}>{item.done ? '✓' : index + 1} {item.label}</span>
                    ))}
                  </div>
                </div>

                <div className="anchors-pick-grid">
                  {pickTargets.map((target) => {
                    const anchor = anchors[targetIndexes[target]]
                    const ready = hasGps(anchor)
                    const active = pickTarget === target
                    return (
                      <button key={target} className={`anchors-pick-button${ready ? ' ready' : ''}${active ? ' active' : ''}`} type="button" onClick={() => setPickTarget(target)} disabled={isApplied}>
                        <strong>{labels.targets[target]}</strong>
                        <span>{active ? labels.step2.pickButton : ready ? labels.set : labels.unset}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="anchors-position-stack">
                  {pickTargets.map((target) => {
                    const anchor = anchors[targetIndexes[target]]
                    const ready = hasGps(anchor)
                    return (
                      <div key={target} className={ready ? 'anchors-position-card ready' : 'anchors-position-card'}>
                        <header>
                          <span>{labels.targets[target]} · {labels.local} {anchor ? `${anchor.localX.toFixed(1)}, ${anchor.localY.toFixed(1)}` : `${localDefaults[target].x.toFixed(1)}, ${localDefaults[target].y.toFixed(1)}`}</span>
                          <em>{ready ? labels.ready : labels.waiting}</em>
                        </header>
                        <p>{ready ? `${anchor!.latitude.toFixed(7)}, ${anchor!.longitude.toFixed(7)}` : labels.step2.gpsWaiting}</p>
                      </div>
                    )
                  })}
                </div>

                <div className="anchors-section-card">
                  <div className="anchors-action-row">
                    <button className="btn btn-primary" type="button" onClick={() => void handleCompute()} disabled={!canCompute || computing}>
                      {computing ? labels.computing : labels.compute}
                    </button>
                    <button className="btn btn-secondary" type="button" onClick={() => void handleApply()} disabled={!result || applying}>
                      {applying ? labels.applying : labels.apply}
                    </button>
                  </div>
                  <div className="anchors-metric-grid">
                    <MetricTile label={labels.step2.readiness} value={`${readyAnchors.filter((anchor) => pickTargets.some((target) => anchors[targetIndexes[target]]?.id === anchor.id)).length}/3 ${labels.gps}`} tone={canCompute ? 'success' : 'warning'} />
                    <MetricTile label={labels.step2.rmse} value={formatResult(result, labels)} tone={result ? 'success' : 'neutral'} />
                    <MetricTile label={labels.step2.apiRmse} value={apiRmse === null ? '—' : `${apiRmse.toFixed(8)} m`} tone={apiRmse === null ? 'neutral' : 'primary'} />
                    <MetricTile label={labels.step3.transformStatus} value={transformMatrix ? labels.ready : result ? labels.step2.calculated : labels.waiting} tone={result ? 'success' : 'warning'} />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="anchors-step-content" key="step-3">
                <div className={isApplied ? 'anchors-section-card success' : 'anchors-section-card warning'}>
                  <strong>{isApplied ? labels.step3.applied : labels.step3.awaiting}</strong>
                  <p>{statusMessage ?? labels.step3.subtitle}</p>
                </div>
                <div className="anchors-section-card success">
                  <strong>{labels.step3.appliedOrigin}</strong>
                  <p>{appliedOrigin ? `${appliedOrigin[0].toFixed(7)}, ${appliedOrigin[1].toFixed(7)}` : formatGps(origin, labels)}</p>
                </div>
                <div className="anchors-metric-grid">
                  <MetricTile label={labels.step3.metrics} value={formatResult(result, labels)} tone="success" />
                  <MetricTile label={labels.step1.anchorCount} value={String(anchors.length)} />
                  <MetricTile label={labels.step1.gpsCount} value={`${readyAnchors.length}`} tone="primary" />
                  <MetricTile label={labels.step3.transformStatus} value={isApplied ? labels.step3.applied : labels.step3.awaiting} tone={isApplied ? 'success' : 'warning'} />
                </div>
                <button className="btn btn-secondary" type="button" onClick={handleRestart}>{labels.restart}</button>
              </div>
            )}

            {statusMessage && currentStep !== 3 && <div className="anchors-step-content"><div className="anchors-message success">{statusMessage}</div></div>}
            {errorMessage && <div className="anchors-step-content"><div className="anchors-message danger">{errorMessage}</div></div>}

            <div className="anchors-workflow-footer">
              <button className="btn btn-secondary" type="button" onClick={() => setCurrentStep((currentStep - 1) as StepId)} disabled={currentStep === 1}>
                {labels.previous}
              </button>
              <small>{labels.currentStep}: {currentStep}/3</small>
              {currentStep < 3 ? (
                <button className="btn btn-primary" type="button" onClick={() => setCurrentStep((currentStep + 1) as StepId)} disabled={!canAdvanceFromStep}>
                  {currentStep === 2 ? labels.finish : labels.next}
                </button>
              ) : (
                <button className="btn btn-primary" type="button" onClick={handleRestart}>{labels.restart}</button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
