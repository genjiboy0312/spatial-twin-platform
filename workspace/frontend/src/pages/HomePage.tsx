import { Link } from 'react-router'
import type { ReactNode } from 'react'

import { usePreferences } from '../app/preferences'
import { PageHeader } from './PageHeader'

type HomeIconName = 'build' | 'inspect' | 'monitor' | 'check' | 'clock' | 'arrow' | 'dashboard'

type IntentCard = {
  id: 'build' | 'inspect' | 'monitor'
  title: string
  subtitle: string
  description: string
  cta: string
  to: string
  icon: HomeIconName
  steps: string[]
}

const copy = {
  en: {
    eyebrow: 'Home',
    title: 'Start Work',
    description: 'Choose the right spatial twin workflow, resume progress, or jump into operations from one compact command page.',
    dashboard: 'View Dashboard',
    inProgress: 'In-progress workflow',
    workflowLabel: 'Build workflow',
    buildingName: 'Seoul Tower Pilot',
    currentStep: 'Current Step',
    completed: 'Completed',
    progress: 'Progress',
    updated: 'Updated 12m ago',
    resume: 'Resume Workflow',
    goProjects: 'Choose Project',
    resumeHint: 'Continue the latest building workspace or start a fresh project from the project list.',
    commonSteps: 'Common workflow matrix',
    buildStandard: 'Build standard',
    stepLabel: 'Step',
    intents: [
      {
        id: 'build',
        title: 'Build New Site',
        subtitle: 'Step 1-6 full setup',
        description: 'Create a building, connect source data, align coordinates, map devices, validate, and enter operations.',
        cta: 'Start Build',
        to: '/projects',
        icon: 'build',
        steps: ['Project', 'Data', 'GPS', 'Devices', 'Validate', 'Operate'],
      },
      {
        id: 'inspect',
        title: 'Inspect Existing Site',
        subtitle: 'Fast review path',
        description: 'Open uploaded data, inspect alignment quality, run validation, and review operational readiness.',
        cta: 'Start Inspection',
        to: '/data-sources',
        icon: 'inspect',
        steps: ['Select', 'Align', 'Validate', 'Review'],
      },
      {
        id: 'monitor',
        title: 'Monitor Operations',
        subtitle: 'Live operations mode',
        description: 'Move directly into monitoring for alerts, device status, and local stack health.',
        cta: 'Open Monitor',
        to: '/monitor',
        icon: 'monitor',
        steps: ['Events', 'Status', 'Response'],
      },
    ] satisfies IntentCard[],
    setupSteps: ['Create or select project', 'Connect data sources', 'Set GPS alignment', 'Map devices', 'Validate model', 'Enter workspace'],
  },
  ko: {
    eyebrow: '홈',
    title: '작업 시작',
    description: '공간 트윈 워크플로우를 선택하고, 진행 중 작업을 이어가거나, 운영 화면으로 바로 진입합니다.',
    dashboard: '대시보드 보기',
    inProgress: '진행 중인 작업',
    workflowLabel: 'Build 워크플로우',
    buildingName: '서울 타워 파일럿',
    currentStep: '현재 단계',
    completed: '완료',
    progress: '진행률',
    updated: '12분 전 업데이트',
    resume: '작업 이어가기',
    goProjects: '프로젝트 선택',
    resumeHint: '최근 건물 워크스페이스를 계속 진행하거나 프로젝트 목록에서 새 작업을 시작합니다.',
    commonSteps: '공통 워크플로우 단계',
    buildStandard: 'Build 기준',
    stepLabel: '단계',
    intents: [
      {
        id: 'build',
        title: '신규 현장 구축',
        subtitle: 'Step 1-6 전체 설정',
        description: '건물 생성, 데이터 연결, GPS 정합, 장치 매핑, 검증, 운영 진입까지 순서대로 진행합니다.',
        cta: '구축 시작',
        to: '/projects',
        icon: 'build',
        steps: ['프로젝트', '데이터', 'GPS', '장치', '검증', '운영'],
      },
      {
        id: 'inspect',
        title: '기존 현장 점검',
        subtitle: '빠른 검토 경로',
        description: '업로드된 데이터를 열고 정합 품질, 검증 상태, 운영 준비도를 빠르게 확인합니다.',
        cta: '점검 시작',
        to: '/data-sources',
        icon: 'inspect',
        steps: ['선택', '정합', '검증', '리뷰'],
      },
      {
        id: 'monitor',
        title: '운영 모니터링',
        subtitle: '실시간 운영 모드',
        description: '알림, 장치 상태, 로컬 스택 상태를 보는 모니터링 화면으로 바로 이동합니다.',
        cta: '모니터 열기',
        to: '/monitor',
        icon: 'monitor',
        steps: ['이벤트', '상태', '대응'],
      },
    ] satisfies IntentCard[],
    setupSteps: ['프로젝트 선택/생성', '데이터소스 연결', 'GPS 정합 설정', '장치 매핑', '모델 검증', '작업공간 진입'],
  },
} as const

function HomeIcon({ name }: { name: HomeIconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
  } as const

  const icons = {
    build: <path {...common} d="M4 20V8l8-4 8 4v12M8 20v-7h8v7M9 9h.01M15 9h.01" />,
    inspect: (
      <>
        <circle {...common} cx="11" cy="11" r="6" />
        <path {...common} d="m16 16 4 4M8.5 11h5M11 8.5v5" />
      </>
    ),
    monitor: <path {...common} d="M4 5h16v11H4zM9 20h6M12 16v4M7 12l3-3 3 3 4-5" />,
    check: <path {...common} d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle {...common} cx="12" cy="12" r="8" />
        <path {...common} d="M12 7v5l3 2" />
      </>
    ),
    arrow: <path {...common} d="M5 12h14M13 6l6 6-6 6" />,
    dashboard: <path {...common} d="M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z" />,
  } satisfies Record<HomeIconName, ReactNode>

  return (
    <svg aria-hidden="true" className="home-icon-svg" viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  )
}

export function HomePage() {
  const { language } = usePreferences()
  const labels = copy[language]

  return (
    <section className="page-grid home-start-page">
      <div className="home-header-row">
        <PageHeader eyebrow={labels.eyebrow} title={labels.title} description={labels.description} />
        <Link className="btn btn-secondary home-dashboard-link" to="/dashboard">
          <HomeIcon name="dashboard" />
          {labels.dashboard}
        </Link>
      </div>

      <section className="home-resume-card">
        <div className="home-resume-topline" />
        <div className="home-resume-header">
          <div className="home-resume-title">
            <span className="home-icon-box">
              <HomeIcon name="clock" />
            </span>
            <div>
              <span className="eyebrow-muted">{labels.inProgress}</span>
              <h2>{labels.workflowLabel}</h2>
              <p>{labels.buildingName}</p>
            </div>
          </div>
          <div className="home-badge-row">
            <span className="home-badge info">Step 4/6</span>
            <span className="home-badge success">67%</span>
            <span className="home-badge muted">{labels.updated}</span>
          </div>
        </div>

        <div className="home-resume-panel">
          <div className="home-progress-stats">
            <div>
              <span>{labels.currentStep}</span>
              <strong>4/6</strong>
            </div>
            <div>
              <span>{labels.completed}</span>
              <strong>3</strong>
            </div>
            <div>
              <span>{labels.progress}</span>
              <strong>67%</strong>
            </div>
          </div>
          <div className="home-progress-track" aria-hidden="true">
            <span style={{ width: '67%' }} />
          </div>
          <div className="home-resume-actions">
            <Link className="btn btn-primary" to="/validation">
              {labels.resume}
              <HomeIcon name="arrow" />
            </Link>
            <Link className="btn btn-secondary" to="/projects">
              {labels.goProjects}
            </Link>
          </div>
        </div>

        <p className="home-resume-note">{labels.resumeHint}</p>
      </section>

      <section className="home-intent-grid">
        {labels.intents.map((intent) => (
          <Link key={intent.id} className={`home-intent-card ${intent.id === 'build' ? 'primary' : ''}`} to={intent.to}>
            <div className="home-card-topline" />
            <div className="home-intent-header">
              <div>
                <span className="eyebrow-muted">{intent.subtitle}</span>
                <h3>{intent.title}</h3>
              </div>
              <span className="home-icon-box">
                <HomeIcon name={intent.icon} />
              </span>
            </div>
            <p>{intent.description}</p>
            <div className="home-step-chip-row">
              {intent.steps.map((step, index) => (
                <span key={step} className={index === 0 ? 'home-step-chip active' : 'home-step-chip'}>
                  {index + 1}. {step}
                </span>
              ))}
            </div>
            <span className="home-card-cta">
              {intent.cta}
              <HomeIcon name="arrow" />
            </span>
          </Link>
        ))}
      </section>

      <section className="home-workflow-card">
        <div className="home-card-topline" />
        <div className="home-workflow-header">
          <div>
            <span className="eyebrow-muted">Workflow Matrix</span>
            <h3>{labels.commonSteps}</h3>
          </div>
          <span className="home-badge teal">{labels.buildStandard}</span>
        </div>
        <div className="home-workflow-grid">
          {labels.setupSteps.map((step, index) => (
            <div key={step} className="home-workflow-step">
              <span className="home-icon-box compact">
                <HomeIcon name="check" />
              </span>
              <div>
                <small>
                  {labels.stepLabel} {index + 1}
                </small>
                <strong>{step}</strong>
              </div>
            </div>
          ))}
        </div>
      </section>
    </section>
  )
}
