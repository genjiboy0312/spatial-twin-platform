type AlignmentMethod = 'osm' | 'pointcloud'

type Floor = {
  id: number
  floor_number: number
  floor_name: string | null
  height_meters?: number
}

type Language = 'ko' | 'en'

const labels = {
  ko: {
    methodTitle: '정합 방법',
    modelOsm: 'Model + OSM',
    modelOsmDescription: 'DXF · DWG · GLB 모델과 OSM 지도 로드',
    pointCloudOsm: 'Point Cloud + OSM',
    pointCloudDescription: 'PointCloud 파일을 업로드해야 활성화됩니다.',
    selected: '선택됨',
    disabled: '비활성',
    floorTitle: '층 선택',
    noFloors: '등록된 층이 없습니다.',
    goToProjects: '프로젝트로 이동',
    floorLabel: (floorNumber: number) => `${floorNumber}F`,
    viewModeTitle: '뷰 모드',
    top: 'Top',
    perspective: 'Perspective',
    originStatusTitle: 'GPS 원점 상태',
    originSet: '원점 설정됨',
    originUnset: '원점 미설정',
  },
  en: {
    methodTitle: 'Alignment Method',
    modelOsm: 'Model + OSM',
    modelOsmDescription: 'Load DXF, DWG, GLB models with OSM map.',
    pointCloudOsm: 'Point Cloud + OSM',
    pointCloudDescription: 'Upload point-cloud files to enable this flow.',
    selected: 'Selected',
    disabled: 'Disabled',
    floorTitle: 'Floor Selection',
    noFloors: 'No floors are registered.',
    goToProjects: 'Go to Projects',
    floorLabel: (floorNumber: number) => `Floor ${floorNumber}`,
    viewModeTitle: 'View Mode',
    top: 'Top',
    perspective: 'Perspective',
    originStatusTitle: 'GPS Origin Status',
    originSet: 'Origin set',
    originUnset: 'Origin unset',
  },
} as const

interface AlignmentLeftPanelProps {
  alignmentMethod: AlignmentMethod
  setAlignmentMethod: (method: AlignmentMethod) => void
  floors: Floor[]
  selectedFloorId: number | null
  handleFloorSelectWithSpatial: (floorId: number) => Promise<void>
  goToProjects: () => void
  cameraViewMode: 'top' | 'perspective'
  setCameraViewMode: (mode: 'top' | 'perspective') => void
  buildingOrigin: [number, number] | null
  hasOsmData: boolean
  hasPointCloudData: boolean
  language?: Language
}

export function AlignmentLeftPanel({
  alignmentMethod,
  setAlignmentMethod,
  floors,
  selectedFloorId,
  handleFloorSelectWithSpatial,
  goToProjects,
  cameraViewMode,
  setCameraViewMode,
  buildingOrigin,
  hasOsmData,
  hasPointCloudData,
  language = 'ko',
}: AlignmentLeftPanelProps) {
  const t = labels[language]
  const sortedFloors = floors.slice().sort((a, b) => b.floor_number - a.floor_number)
  const methodOptions = [
    {
      value: 'osm' as const,
      icon: 'map',
      label: t.modelOsm,
      description: t.modelOsmDescription,
      enabled: hasOsmData,
    },
    {
      value: 'pointcloud' as const,
      icon: 'layers',
      label: t.pointCloudOsm,
      description: t.pointCloudDescription,
      enabled: hasPointCloudData,
    },
  ]

  return (
    <aside className="alignment-reference-left-panel">
      <section className="alignment-left-section">
        <h3>{t.methodTitle}</h3>
        <div className="alignment-method-list">
          {methodOptions.map((option) => {
            const selected = alignmentMethod === option.value
            const disabled = !option.enabled
            return (
              <button
                key={option.value}
                className={`alignment-method-card ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                type="button"
                disabled={disabled}
                onClick={() => setAlignmentMethod(option.value)}
              >
                <span className="alignment-method-icon" data-icon={option.icon} />
                <span className="alignment-method-copy">
                  <span className="alignment-method-title-row">
                    <strong>{option.label}</strong>
                    <em>{selected ? t.selected : disabled ? t.disabled : ''}</em>
                  </span>
                  <small>{option.description}</small>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="alignment-left-section">
        <h3>{t.floorTitle}</h3>
        {sortedFloors.length === 0 ? (
          <div className="alignment-empty-box">
            <p>{t.noFloors}</p>
            <button className="btn btn-secondary" type="button" onClick={goToProjects}>{t.goToProjects}</button>
          </div>
        ) : (
          <div className="alignment-floor-list">
            {sortedFloors.map((floor) => {
              const selected = selectedFloorId === floor.id
              return (
                <button
                  key={floor.id}
                  className={selected ? 'selected' : ''}
                  type="button"
                  onClick={() => void handleFloorSelectWithSpatial(floor.id)}
                >
                  <strong>{floor.floor_name ?? t.floorLabel(floor.floor_number)}</strong>
                  <small>{floor.height_meters ?? 3}m · #{floor.id}</small>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="alignment-left-section">
        <h3>{t.viewModeTitle}</h3>
        <div className="alignment-view-mode-buttons">
          {(['top', 'perspective'] as const).map((mode) => (
            <button
              key={mode}
              className={cameraViewMode === mode ? 'active' : ''}
              type="button"
              onClick={() => setCameraViewMode(mode)}
            >
              {mode === 'top' ? t.top : t.perspective}
            </button>
          ))}
        </div>
      </section>

      <section className="alignment-left-section">
        <h3>{t.originStatusTitle}</h3>
        <div className={`alignment-origin-status ${buildingOrigin ? 'ready' : ''}`}>
          <strong>{buildingOrigin ? t.originSet : t.originUnset}</strong>
          {buildingOrigin && <small>{buildingOrigin[0].toFixed(6)}, {buildingOrigin[1].toFixed(6)}</small>}
        </div>
      </section>
    </aside>
  )
}
