import { usePreferences } from '../app/preferences'

type PageHeaderProps = {
  eyebrow: string
  title: string
  description: string
}

const TRANSLATIONS: Record<string, string> = {
  System: '시스템',
  Workspace: '워크스페이스',
  Editor: '편집기',
  Alignment: '정렬',
  Analysis: '분석',
  Operations: '운영',
  Export: '내보내기',
  Settings: '설정',
  'Spatial Twin Platform': '공간 트윈 플랫폼',
  'Operations Overview': '운영 개요',
  Projects: '프로젝트',
  'Data Sources': '데이터 소스',
  '2D / 3D Editor': '2D / 3D 편집기',
  'GPS Alignment': 'GPS 정렬',
  'Point Cloud': '포인트 클라우드',
  'Model Registry': '모델 레지스트리',
  'Alignment Anchors': '정렬 앵커',
  'Security Devices': '보안 장치',
  'Coverage Analysis': '커버리지 분석',
  Pathfinding: '경로 탐색',
  Validation: '검증',
  Monitor: '모니터',
  'Open the project workspace, jump into editing, or inspect operations at a glance.':
    '프로젝트 워크스페이스를 열고, 편집으로 이동하거나 운영 상태를 한눈에 확인합니다.',
  'Track core spatial twin signals across editing, alignment, validation, and operations.':
    '편집, 정렬, 검증, 운영 전반의 핵심 공간 트윈 상태를 추적합니다.',
  'Create and manage building workspaces for spatial twin editing.':
    '공간 트윈 편집을 위한 건물 워크스페이스를 생성하고 관리합니다.',
  'Register files, scans, maps, and sensor feeds before alignment.':
    '정렬 전에 파일, 스캔, 지도, 센서 피드를 등록합니다.',
  'Draw floor plates, walls, rooms, doors, windows, and device placements.':
    '바닥, 벽, 방, 문, 창문, 장치 배치를 그립니다.',
  'Match building geometry with GPS anchors and sampled control points.':
    '건물 형상을 GPS 앵커와 샘플 제어점에 맞춰 정렬합니다.',
  'Inspect scan metadata, density, and processing readiness for spatial alignment.':
    '공간 정렬을 위한 스캔 메타데이터, 밀도, 처리 준비 상태를 확인합니다.',
  'Manage generated meshes, BIM links, and versioned spatial assets.':
    '생성된 메시, BIM 링크, 버전별 공간 자산을 관리합니다.',
  'Keep GPS control points and floor anchors ready for alignment workflows.':
    '정렬 워크플로를 위해 GPS 제어점과 층 앵커를 준비합니다.',
  'Review camera, access control, and IoT device inventory before export.':
    '내보내기 전에 카메라, 출입 통제, IoT 장치 목록을 검토합니다.',
  'Estimate sensor visibility and identify coverage gaps in the current floor plan.':
    '현재 평면도에서 센서 가시성과 커버리지 공백을 추정합니다.',
  'Generate indoor routing candidates between devices, rooms, and exits.':
    '장치, 방, 출구 사이의 실내 경로 후보를 생성합니다.',
  'Run consistency checks before exporting the spatial twin package.':
    '공간 트윈 패키지를 내보내기 전에 일관성 검사를 실행합니다.',
  'Package geometry and device data into downstream-friendly formats.':
    '형상과 장치 데이터를 후속 시스템에 적합한 형식으로 패키징합니다.',
  'Observe live service, sync, and processing health for the local stack.':
    '로컬 스택의 서비스, 동기화, 처리 상태를 실시간으로 확인합니다.',
  'Manage API, language, units, and coordinate preferences for the workspace.':
    '워크스페이스의 API, 언어, 단위, 좌표 설정을 관리합니다.',
}

function translate(value: string, language: string) {
  return language === 'ko' ? TRANSLATIONS[value] ?? value : value
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  const { language } = usePreferences()

  return (
    <header className="page-header">
      <span>{translate(eyebrow, language)}</span>
      <h1>{translate(title, language)}</h1>
      <p>{translate(description, language)}</p>
    </header>
  )
}
