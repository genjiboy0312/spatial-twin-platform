import { useMemo, useState } from 'react'

import { useAlignmentContext } from '../context/AlignmentContext'
import { OSMOriginPickerPopup } from './OSMOriginPickerPopup'

type Language = 'ko' | 'en'
type StepId = 1 | 2 | 3

const labels = {
  ko: {
    title: 'OSM 정합',
    buildingFallback: '현재 프로젝트',
    scopeBuilding: '건물 단위',
    scopeFloor: '층 단위',
    originStep: 'OSM 기준',
    alignStep: '3점 정합',
    saveStep: '변환·저장',
    originReady: '기준점이 설정되었습니다.',
    originEmpty: 'OSM 기준점을 먼저 설정하세요.',
    stepHintLocked: '이전 설정을 완료해야 진행할 수 있습니다.',
    stepHintReady: '이 단계를 진행할 수 있습니다.',
    latitude: '위도',
    longitude: '경도',
    applyOrigin: '좌표 적용',
    resetOrigin: '기본값',
    pickOrigin: '기준점 정하기',
    loaded: '건물 단위 정합/Transform 설정을 불러왔습니다.',
    nextAlign: '다음 단계: 3점 정합',
    nextSave: '다음 단계: 변환·저장',
    localPoint: '로컬 기준점',
    currentMode: '현재 픽 모드',
    idle: '대기',
    origin: 'Origin',
    point1: 'Point 1',
    point2: 'Point 2',
    pickPoint: '기준점 선택',
    notSet: '미설정',
    done: '완료',
    ready: '로컬 기준점과 GPS 좌표가 준비되었습니다.',
    needPoints: 'Origin, Point 1, Point 2의 로컬/GPS 좌표가 필요합니다.',
    align: '정합 계산',
    result: '정합 결과',
    rmse: 'RMSE',
    matrix: '정합 행렬',
    matrixEmpty: '아직 계산된 정합 행렬이 없습니다.',
    showLabels: '정합 GPS 라벨 표시',
    save: '지도 설정 저장',
    error: '오류',
  },
  en: {
    title: 'OSM Alignment',
    buildingFallback: 'Current Project',
    scopeBuilding: 'Building',
    scopeFloor: 'Floor',
    originStep: 'OSM Reference',
    alignStep: '3-Point Align',
    saveStep: 'Transform·Save',
    originReady: 'Reference origin is set.',
    originEmpty: 'Set the OSM reference origin first.',
    stepHintLocked: 'Complete the previous setting to continue.',
    stepHintReady: 'This step is available.',
    latitude: 'Latitude',
    longitude: 'Longitude',
    applyOrigin: 'Apply coordinates',
    resetOrigin: 'Default',
    pickOrigin: 'Pick reference point',
    loaded: 'Building alignment/transform settings loaded.',
    nextAlign: 'Next: 3-point alignment',
    nextSave: 'Next: Transform·Save',
    localPoint: 'Local point',
    currentMode: 'Current pick mode',
    idle: 'Idle',
    origin: 'Origin',
    point1: 'Point 1',
    point2: 'Point 2',
    pickPoint: 'Pick point',
    notSet: 'Unset',
    done: 'Done',
    ready: 'Local points and GPS coordinates are ready.',
    needPoints: 'Origin, Point 1, and Point 2 local/GPS coordinates are required.',
    align: 'Do Align',
    result: 'Alignment Result',
    rmse: 'RMSE',
    matrix: 'Alignment Matrix',
    matrixEmpty: 'No alignment matrix has been calculated yet.',
    showLabels: 'Show aligned GPS labels',
    save: 'Save map settings',
    error: 'Error',
  },
} as const

function hasNumber(value: string) {
  return value.trim() !== '' && Number.isFinite(Number(value))
}

function formatPoint(point: [number, number, number] | null) {
  if (!point) return 'X -- / Y -- / Z --'
  return `X ${point[0].toFixed(2)} / Y ${point[1].toFixed(2)} / Z ${point[2].toFixed(2)}`
}

function StepBadge({ index, complete, locked }: { index: number; complete: boolean; locked: boolean }) {
  if (complete) return <span className="ap-flow-badge complete">✓</span>
  if (locked) return <span className="ap-flow-badge locked">🔒</span>
  return <span className="ap-flow-badge">{index}</span>
}

export function OSMAlignmentPanel({ language = 'ko' }: { language?: Language }) {
  const t = labels[language]
  const ctx = useAlignmentContext()
  const [currentStep, setCurrentStep] = useState<StepId>(1)
  const [originPickerOpen, setOriginPickerOpen] = useState(false)

  const pointsReady = Boolean(ctx.alignLocalPoints.origin && ctx.alignLocalPoints.point1 && ctx.alignLocalPoints.point2)
  const gpsReady = Object.values(ctx.alignGpsInputs).every(hasNumber)
  const step1Complete = Boolean(ctx.buildingOrigin)
  const step2Complete = Boolean(ctx.alignmentMatrix && ctx.alignmentRmse !== null)

  const steps = useMemo(
    () => [
      { id: 1 as StepId, label: t.originStep, complete: step1Complete, locked: false },
      { id: 2 as StepId, label: t.alignStep, complete: step2Complete, locked: !step1Complete },
      { id: 3 as StepId, label: t.saveStep, complete: false, locked: !step2Complete },
    ],
    [step1Complete, step2Complete, t],
  )

  const setGpsInput = (key: keyof typeof ctx.alignGpsInputs, value: string) => {
    ctx.setAlignGpsInputs((prev) => ({ ...prev, [key]: value }))
  }

  const gotoStep = (step: StepId) => {
    const target = steps.find((item) => item.id === step)
    if (!target || target.locked) return
    setCurrentStep(step)
  }

  const renderProgress = () => (
    <div className="ap-flow-progress">
      {steps.map((step, index) => (
        <button
          key={step.id}
          type="button"
          className={`ap-flow-step ${currentStep === step.id ? 'active' : ''} ${step.locked ? 'locked' : ''}`}
          disabled={step.locked}
          title={step.locked ? t.stepHintLocked : t.stepHintReady}
          onClick={() => gotoStep(step.id)}
        >
          <StepBadge index={index + 1} complete={step.complete} locked={step.locked} />
          <span>{step.label}</span>
        </button>
      ))}
    </div>
  )

  const renderStep1 = () => (
    <div className="ap-step-content">
      <div className="ap-scope-row">
        <span>{t.scopeBuilding}</span>
        <span>{t.scopeFloor}</span>
      </div>
      <div className={`ap-status-card ${ctx.buildingOrigin ? 'success' : 'warning'}`}>
        <strong>
          {ctx.buildingOrigin
            ? `${ctx.buildingOrigin[0].toFixed(7)}, ${ctx.buildingOrigin[1].toFixed(7)}`
            : t.originEmpty}
        </strong>
        <span>{ctx.buildingOrigin ? t.originReady : t.originEmpty}</span>
      </div>
      <div className="ap-form-grid">
        <label>
          {t.latitude}
          <input value={ctx.quadOriginInput.lat} onChange={(event) => ctx.setQuadOriginInput((prev) => ({ ...prev, lat: event.target.value }))} />
        </label>
        <label>
          {t.longitude}
          <input value={ctx.quadOriginInput.lng} onChange={(event) => ctx.setQuadOriginInput((prev) => ({ ...prev, lng: event.target.value }))} />
        </label>
      </div>
      {ctx.quadOriginInputError && <div className="ap-status-card danger">{ctx.quadOriginInputError}</div>}
      <div className="ap-button-row">
        <button type="button" className="ap-action primary" onClick={ctx.applyQuadOriginInput}>{t.applyOrigin}</button>
        <button type="button" className="ap-action" onClick={ctx.resetQuadOriginToDefault}>{t.resetOrigin}</button>
      </div>
      <button type="button" className="ap-action primary wide" onClick={() => setOriginPickerOpen(true)}>⌖ {t.pickOrigin}</button>
      <div className="ap-status-card muted">{t.loaded}</div>
      <button type="button" className="ap-action primary wide" disabled={!step1Complete} title={!step1Complete ? t.stepHintLocked : t.stepHintReady} onClick={() => gotoStep(2)}>
        {step1Complete ? t.nextAlign : `🔒 ${t.nextAlign}`}
      </button>
      <OSMOriginPickerPopup
        open={originPickerOpen}
        currentOrigin={ctx.buildingOrigin}
        language={language}
        onClose={() => setOriginPickerOpen(false)}
        onConfirm={(origin) => {
          ctx.setBuildingOrigin(origin)
          ctx.setQuadOriginInput(() => ({ lat: String(origin[0]), lng: String(origin[1]) }))
          ctx.setAlignGpsInputs((prev) => ({ ...prev, originLat: String(origin[0]), originLng: String(origin[1]) }))
          setOriginPickerOpen(false)
        }}
      />
    </div>
  )

  const renderPointCard = (
    keyName: 'origin' | 'point1' | 'point2',
    title: string,
    latKey: keyof typeof ctx.alignGpsInputs,
    lngKey: keyof typeof ctx.alignGpsInputs,
  ) => {
    const point = ctx.alignLocalPoints[keyName]
    const ready = Boolean(point && hasNumber(ctx.alignGpsInputs[latKey]) && hasNumber(ctx.alignGpsInputs[lngKey]))
    return (
      <article className={`ap-point-row ${ready ? 'ready' : ''}`}>
        <div>
          <strong>{title}</strong>
          <small>{formatPoint(point)}</small>
        </div>
        <button type="button" onClick={() => ctx.setPickMode(keyName)}>
          {ready ? t.done : t.pickPoint}
        </button>
        <div className="ap-form-grid">
          <label>
            {t.latitude}
            <input value={ctx.alignGpsInputs[latKey]} onChange={(event) => setGpsInput(latKey, event.target.value)} />
          </label>
          <label>
            {t.longitude}
            <input value={ctx.alignGpsInputs[lngKey]} onChange={(event) => setGpsInput(lngKey, event.target.value)} />
          </label>
        </div>
      </article>
    )
  }

  const renderStep2 = () => (
    <div className="ap-step-content">
      <div className={`ap-status-card ${pointsReady && gpsReady ? 'success' : 'warning'}`}>
        {pointsReady && gpsReady ? t.ready : t.needPoints}
      </div>
      <div className="ap-status-card muted">{t.currentMode}: {ctx.pickMode === 'none' ? t.idle : ctx.pickMode}</div>
      {renderPointCard('origin', t.origin, 'originLat', 'originLng')}
      {renderPointCard('point1', t.point1, 'point1Lat', 'point1Lng')}
      {renderPointCard('point2', t.point2, 'point2Lat', 'point2Lng')}
      {ctx.alignmentError && <div className="ap-status-card danger"><strong>{t.error}</strong> {ctx.alignmentError}</div>}
      <button className="ap-action success wide" type="button" disabled={!pointsReady || !gpsReady} onClick={() => void ctx.onDoAlign()}>
        {pointsReady && gpsReady ? t.align : `🔒 ${t.align}`}
      </button>
      <button type="button" className="ap-action primary wide" disabled={!step2Complete} title={!step2Complete ? t.stepHintLocked : t.stepHintReady} onClick={() => gotoStep(3)}>
        {step2Complete ? t.nextSave : `🔒 ${t.nextSave}`}
      </button>
    </div>
  )

  const renderStep3 = () => (
    <div className="ap-step-content">
      <div className="ap-status-card success">
        {t.result}: {t.rmse} {ctx.alignmentRmse !== null ? `${ctx.alignmentRmse.toFixed(3)} m` : '-'}
      </div>
      <div className="ap-matrix-card">
        <strong>{t.matrix}</strong>
        {ctx.alignmentMatrix
          ? ctx.alignmentMatrix.map((row, index) => <span key={index}>{row.map((value) => value.toFixed(8)).join(', ')}</span>)
          : <span>{t.matrixEmpty}</span>}
      </div>
      <label className="ap-check-row">
        <input
          type="checkbox"
          checked={ctx.showAlignedGpsBillboardText}
          onChange={(event) => ctx.setShowAlignedGpsBillboardText(event.target.checked)}
        />
        {t.showLabels}
      </label>
      <button className="ap-action primary wide" type="button">{t.save}</button>
    </div>
  )

  return (
    <div className="ap-panel">
      <div className="ap-panel-head">
        <div>
          <strong>{t.title}</strong>
          <span>{ctx.currentBuilding?.name ?? t.buildingFallback}</span>
        </div>
        {renderProgress()}
      </div>
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
    </div>
  )
}
