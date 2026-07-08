import { Suspense, useMemo, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'

import { useWorkflowStore, type WorkflowStep } from '../../stores/workflowStore'
import { setPreference, type Language, usePreferences } from '../preferences'

const navGroups = [
  {
    labelKey: 'workspace',
    items: [
      ['Home', '/home', 'home'],
      ['Projects', '/projects', 'projects'],
      ['Data Sources', '/data-sources', 'database'],
    ],
  },
  {
    labelKey: 'spatialTwin',
    items: [
      ['Editor', '/editor', 'editor'],
      ['Alignment', '/alignment', 'alignment'],
      ['Validation', '/validation', 'validation'],
      ['Dashboard', '/dashboard', 'dashboard'],
      ['Models', '/models', 'models'],
      ['Point Cloud', '/point-cloud', 'point-cloud'],
      ['Devices', '/devices', 'devices'],
      ['Anchors', '/anchors', 'anchors'],
    ],
  },
] as const

const pinnedNavItems = [
  ['Monitor', '/monitor', 'monitor'],
  ['Settings', '/settings', 'settings'],
] as const

const APP_LABELS = {
  en: {
    brandSubtitle: 'Security Operations',
    currentWorkspace: 'Current Workspace',
    status: ['Docker Live', 'API :8000', 'UI :5174'],
    toggle: 'Sidebar toggle',
    previous: 'Previous',
    next: 'Next',
    endWorkflow: 'End Workflow',
    workflowTitle: 'Scenario Play',
    workflowSubtitle: 'Build workflow',
    current: 'Current',
    complete: 'Complete',
    pending: 'Pending',
    progress: 'progress',
    actions: {
      settings: 'Open settings',
      theme: 'Toggle light/dark mode',
      notifications: 'Open notifications',
      notificationTitle: 'Notifications',
      notificationSubtitle: 'Spatial twin system events',
      warning: 'Warning',
      caution: 'Caution',
      normal: 'Normal',
      close: 'Close notifications',
    },
    groups: {
      workspace: 'Workspace',
      spatialTwin: 'Spatial Twin',
    },
    nav: {
      Home: 'Home',
      Projects: 'Projects',
      'Data Sources': 'Data Sources',
      Editor: '3D Editor',
      Alignment: 'GPS Alignment',
      Validation: 'Validation',
      Dashboard: 'Dashboard',
      Models: 'Model Management',
      'Point Cloud': 'PointCloud',
      Devices: 'Device Management',
      Anchors: 'Anchor/Map',
      Monitor: 'Monitor',
      Settings: 'Settings',
    },
  },
  ko: {
    brandSubtitle: '보안 운영',
    currentWorkspace: '현재 워크스페이스',
    status: ['도커 실행중', 'API :8000', 'UI :5174'],
    toggle: '사이드바 토글',
    previous: '이전',
    next: '다음',
    endWorkflow: '워크플로 종료',
    workflowTitle: '시나리오 플레이',
    workflowSubtitle: 'Build 워크플로',
    current: '현재',
    complete: '완료',
    pending: '대기',
    progress: '진행',
    actions: {
      settings: '설정 열기',
      theme: '라이트/다크 모드 전환',
      notifications: '알림 열기',
      notificationTitle: '알림',
      notificationSubtitle: '공간 트윈 시스템 이벤트',
      warning: '경고',
      caution: '주의',
      normal: '정상',
      close: '알림 닫기',
    },
    groups: {
      workspace: '워크스페이스',
      spatialTwin: '공간 트윈',
    },
    nav: {
      Home: '홈',
      Projects: '프로젝트',
      'Data Sources': '데이터소스',
      Editor: '3D 편집',
      Alignment: 'GPS 정합',
      Validation: '검증',
      Dashboard: '대시보드',
      Models: '모델 관리',
      'Point Cloud': 'PointCloud',
      Devices: '장치관리',
      Anchors: 'Anchor/Map',
      Monitor: '모니터',
      Settings: '설정',
    },
  },
} as const

type NavLabel = keyof typeof APP_LABELS.en.nav

const routeTitleKeys: Record<string, NavLabel> = {
  '/': 'Projects',
  '/home': 'Home',
  '/projects': 'Projects',
  '/data-sources': 'Data Sources',
  '/editor': 'Editor',
  '/alignment': 'Alignment',
  '/validation': 'Validation',
  '/dashboard': 'Dashboard',
  '/models': 'Models',
  '/point-cloud': 'Point Cloud',
  '/devices': 'Devices',
  '/anchors': 'Anchors',
  '/monitor': 'Monitor',
  '/settings': 'Settings',
}

const scenarioSteps: Array<{ id: WorkflowStep; label: NavLabel; shortEn: string; shortKo: string; to: string }> = [
  { id: 'projects', label: 'Projects', shortEn: 'Project', shortKo: '프로젝트', to: '/projects' },
  { id: 'data-sources', label: 'Data Sources', shortEn: 'Data', shortKo: '데이터', to: '/data-sources' },
  { id: 'editor', label: 'Editor', shortEn: '3D Edit', shortKo: '3D 편집', to: '/editor' },
  { id: 'alignment', label: 'Alignment', shortEn: 'GPS', shortKo: 'GPS', to: '/alignment' },
  { id: 'validation', label: 'Validation', shortEn: 'Validate', shortKo: '검증', to: '/validation' },
  { id: 'monitor', label: 'Monitor', shortEn: 'Operate', shortKo: '운영', to: '/monitor' },
]

const notifications = [
  {
    tone: 'warning',
    title: 'PointCloud density dropped',
    titleKo: 'PointCloud 밀도 저하',
    body: 'East corridor scan quality needs a reprocess.',
    bodyKo: '동측 복도 스캔 품질을 다시 처리해야 합니다.',
    time: '2m',
  },
  {
    tone: 'caution',
    title: 'GPS alignment drift',
    titleKo: 'GPS 정합 오차',
    body: 'Anchor A-03 is 0.42m away from the reference.',
    bodyKo: 'Anchor A-03이 기준점에서 0.42m 벗어났습니다.',
    time: '8m',
  },
  {
    tone: 'normal',
    title: 'Validation passed',
    titleKo: '검증 통과',
    body: 'Doors, devices, and model links are consistent.',
    bodyKo: '문, 장치, 모델 링크가 일관된 상태입니다.',
    time: '15m',
  },
] as const

function getRouteTitle(pathname: string, language: Language): string {
  const match = Object.keys(routeTitleKeys)
    .sort((a, b) => b.length - a.length)
    .find((path) => pathname === path || pathname.startsWith(`${path}/`))
  return match ? APP_LABELS[language].nav[routeTitleKeys[match]!] : APP_LABELS[language].nav.Projects
}

type IconName =
  | 'home'
  | 'dashboard'
  | 'projects'
  | 'database'
  | 'editor'
  | 'alignment'
  | 'point-cloud'
  | 'models'
  | 'anchors'
  | 'devices'
  | 'validation'
  | 'monitor'
  | 'settings'

function Icon({ name }: { name: IconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
  } as const

  const icons: Record<IconName, ReactNode> = {
    home: <path {...common} d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />,
    dashboard: <path {...common} d="M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z" />,
    projects: <path {...common} d="M4 7h6l2 2h8v10H4zM4 7v12" />,
    database: (
      <>
        <ellipse {...common} cx="12" cy="6" rx="7" ry="3" />
        <path {...common} d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
      </>
    ),
    editor: <path {...common} d="M5 19h4l10-10a2.1 2.1 0 0 0-3-3L6 16zM13.5 6.5l4 4" />,
    alignment: <path {...common} d="M5 7h14M8 12h8M5 17h14M12 4v16" />,
    validation: <path {...common} d="m5 12 4 4L19 6M4 20h16" />,
    'point-cloud': (
      <>
        <circle {...common} cx="7" cy="8" r="1.4" />
        <circle {...common} cx="14" cy="6" r="1.4" />
        <circle {...common} cx="17" cy="13" r="1.4" />
        <circle {...common} cx="9" cy="16" r="1.4" />
        <path {...common} d="m8 8 5-2M15 7l2 5M16 13l-6 3" />
      </>
    ),
    models: <path {...common} d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" />,
    anchors: <path {...common} d="M12 4v12M8 8a4 4 0 1 1 8 0M5 14c1 4 3.4 6 7 6s6-2 7-6M5 14h4M15 14h4" />,
    devices: <path {...common} d="M7 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM10 17h4" />,
    monitor: <path {...common} d="M4 5h16v11H4zM9 20h6M12 16v4M7 12l3-3 3 3 4-5" />,
    settings: (
      <>
        <circle {...common} cx="12" cy="12" r="3" />
        <path {...common} d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M19.8 7.5 17.2 9M6.8 15l-2.6 1.5" />
      </>
    ),
  }

  return (
    <svg aria-hidden="true" className="nav-icon-svg" viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  )
}

function SidebarToggleIcon() {
  return (
    <svg aria-hidden="true" className="sidebar-toggle-svg" viewBox="0 0 24 24">
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="M9 5v14M14 9l-3 3 3 3" />
    </svg>
  )
}

function TopbarIcon({ name }: { name: 'settings' | 'theme' | 'bell' | 'close' }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
  } as const

  const icons: Record<typeof name, ReactNode> = {
    settings: (
      <>
        <circle {...common} cx="12" cy="12" r="3" />
        <path {...common} d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M19.8 7.5 17.2 9M6.8 15l-2.6 1.5" />
      </>
    ),
    theme: <path {...common} d="M12 3a7 7 0 1 0 7 7 5.8 5.8 0 0 1-7-7ZM5 20h14" />,
    bell: <path {...common} d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
    close: <path {...common} d="M6 6l12 12M18 6 6 18" />,
  }

  return (
    <svg aria-hidden="true" className="topbar-icon-svg" viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  )
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { language, theme } = usePreferences()
  const location = useLocation()
  const navigate = useNavigate()
  const labels = APP_LABELS[language]
  const workflowCurrentStep = useWorkflowStore((state) => state.currentStep)
  const completedSteps = useWorkflowStore((state) => state.completedSteps)
  const setWorkflowCurrentStep = useWorkflowStore((state) => state.setCurrentStep)
  const completeStep = useWorkflowStore((state) => state.completeStep)
  const resetWorkflow = useWorkflowStore((state) => state.resetWorkflow)
  const title = useMemo(() => getRouteTitle(location.pathname, language), [language, location.pathname])
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const activeScenarioIndex = scenarioSteps.findIndex((step) => {
    if (step.id === 'editor') return location.pathname.startsWith('/editor')
    return location.pathname === step.to || location.pathname.startsWith(`${step.to}/`)
  })
  const fallbackScenarioIndex = scenarioSteps.findIndex((step) => step.id === workflowCurrentStep)
  const scenarioIndex = Math.max(activeScenarioIndex >= 0 ? activeScenarioIndex : fallbackScenarioIndex, 0)
  const scenarioProgress = Math.round(((scenarioIndex + 1) / scenarioSteps.length) * 100)
  const currentScenario = scenarioSteps[scenarioIndex]!
  const previousScenario = scenarioSteps[scenarioIndex - 1]
  const nextScenario = scenarioSteps[scenarioIndex + 1]

  const goScenario = (target: typeof scenarioSteps[number]) => {
    setWorkflowCurrentStep(target.id)
    navigate(target.to)
  }

  const goNextScenario = () => {
    if (!nextScenario) return
    completeStep(currentScenario.id)
    goScenario(nextScenario)
  }

  const endWorkflow = () => {
    resetWorkflow()
    navigate('/home')
  }

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>

      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <button className="sidebar-options-button" type="button" onClick={() => setCollapsed((current) => !current)} aria-label={labels.toggle} title={labels.toggle}>
            <SidebarToggleIcon />
          </button>
          <span className="brand-mark">ST</span>
          <div className="brand-copy">
            <strong>Spatial Twin</strong>
            <small>{labels.brandSubtitle}</small>
          </div>
        </div>

        <nav className="nav-list">
          {navGroups.map((group) => (
            <section key={group.labelKey} className="nav-group" aria-label={labels.groups[group.labelKey]}>
              <span className="nav-group-label">{labels.groups[group.labelKey]}</span>
              {group.items.map(([label, to, icon]) => (
                <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} title={collapsed ? labels.nav[label] : undefined}>
                  <span className="nav-icon" aria-hidden="true"><Icon name={icon} /></span>
                  <span className="nav-text">{labels.nav[label]}</span>
                </NavLink>
              ))}
            </section>
          ))}
        </nav>

        <div className="sidebar-footer" aria-label="Pinned navigation">
          {pinnedNavItems.map(([label, to, icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'nav-link active pinned' : 'nav-link pinned')} title={collapsed ? labels.nav[label] : undefined}>
              <span className="nav-icon" aria-hidden="true"><Icon name={icon} /></span>
              <span className="nav-text">{labels.nav[label]}</span>
            </NavLink>
          ))}
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div>
            <span className="topbar-kicker">{labels.currentWorkspace}</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions" aria-label="System status">
            <span className="status-pill">{labels.status[0]}</span>
            <span className="status-pill muted">{labels.status[1]}</span>
            <span className="status-pill muted">{labels.status[2]}</span>
            <NavLink className="topbar-icon-button" to="/settings" title={labels.actions.settings} aria-label={labels.actions.settings}>
              <TopbarIcon name="settings" />
            </NavLink>
            <button className="topbar-icon-button" type="button" title={labels.actions.theme} aria-label={labels.actions.theme} onClick={() => setPreference('theme', nextTheme)}>
              <TopbarIcon name="theme" />
            </button>
            <button className={`topbar-icon-button notification-button ${notificationsOpen ? 'active' : ''}`} type="button" title={labels.actions.notifications} aria-label={labels.actions.notifications} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((current) => !current)}>
              <TopbarIcon name="bell" />
              <span className="notification-dot" />
            </button>
          </div>
        </header>

        <section className="scenario-workflow-bar" aria-label={labels.workflowTitle}>
          <div className="scenario-bottom-summary">
            <span className="topbar-kicker">{labels.workflowTitle}</span>
            <strong>{labels.workflowSubtitle}</strong>
          </div>
          <nav className="scenario-stepper" aria-label={labels.workflowSubtitle}>
            {scenarioSteps.map((step, index) => {
              const isActive = index === scenarioIndex
              const isComplete = completedSteps.includes(step.id) || index < scenarioIndex
              const stateLabel = isActive ? labels.current : isComplete ? labels.complete : labels.pending
              return (
                <NavLink
                  key={step.id}
                  to={step.to}
                  className={`scenario-step ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                  onClick={() => setWorkflowCurrentStep(step.id)}
                >
                  <span className="scenario-step-index">{isComplete ? '✓' : index + 1}</span>
                  <span className="scenario-step-copy">
                    <strong>{language === 'ko' ? step.shortKo : step.shortEn}</strong>
                    <small>{stateLabel}</small>
                  </span>
                </NavLink>
              )
            })}
          </nav>
          <div className="scenario-progress-box">
            <span>{scenarioProgress}% {labels.progress}</span>
            <div className="scenario-progress-track" aria-hidden="true">
              <i style={{ width: `${scenarioProgress}%` }} />
            </div>
          </div>
        </section>

        <main className="content" id="main-content" tabIndex={-1}>
          <Suspense fallback={<div className="card">Loading...</div>}>
            <Outlet />
          </Suspense>
        </main>

        <footer className="scenario-control-bar" aria-label={labels.workflowTitle}>
          <button className="btn btn-secondary" type="button" disabled={!previousScenario} onClick={() => previousScenario && goScenario(previousScenario)}>
            {labels.previous}: {previousScenario ? (language === 'ko' ? previousScenario.shortKo : previousScenario.shortEn) : '-'}
          </button>
          <button className="btn btn-primary" type="button" disabled={!nextScenario} onClick={goNextScenario}>
            {labels.next}: {nextScenario ? (language === 'ko' ? nextScenario.shortKo : nextScenario.shortEn) : '-'}
          </button>
          <button className="btn btn-secondary scenario-end-button" type="button" onClick={endWorkflow}>
            {labels.endWorkflow}
          </button>
        </footer>
      </div>

      <aside className={`notification-drawer ${notificationsOpen ? 'open' : ''}`} aria-hidden={!notificationsOpen}>
        <div className="notification-drawer-header">
          <div>
            <span className="topbar-kicker">{labels.actions.notificationSubtitle}</span>
            <strong>{labels.actions.notificationTitle}</strong>
          </div>
          <button className="topbar-icon-button" type="button" aria-label={labels.actions.close} onClick={() => setNotificationsOpen(false)}>
            <TopbarIcon name="close" />
          </button>
        </div>
        <div className="notification-list">
          {notifications.map((notification) => (
            <article key={notification.title} className={`notification-item ${notification.tone}`}>
              <span className="notification-severity">{labels.actions[notification.tone]}</span>
              <strong>{language === 'ko' ? notification.titleKo : notification.title}</strong>
              <p>{language === 'ko' ? notification.bodyKo : notification.body}</p>
              <small>{notification.time}</small>
            </article>
          ))}
        </div>
      </aside>
    </div>
  )
}
