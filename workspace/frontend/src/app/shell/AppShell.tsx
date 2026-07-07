import { Suspense, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'

const navGroups = [
  {
    label: 'Workspace',
    items: [
      ['Home', '/home', 'H'],
      ['Dashboard', '/dashboard', 'D'],
      ['Projects', '/projects', 'P'],
      ['Data Sources', '/data-sources', 'U'],
    ],
  },
  {
    label: 'Spatial Twin',
    items: [
      ['Editor', '/editor/demo', 'E'],
      ['Alignment', '/alignment', 'A'],
      ['Point Cloud', '/point-cloud', 'L'],
      ['Models', '/models', 'M'],
      ['Anchors', '/anchors', 'N'],
    ],
  },
  {
    label: 'Analysis',
    items: [
      ['Devices', '/devices', 'V'],
      ['Coverage', '/coverage', 'C'],
      ['Pathfinding', '/pathfinding', 'R'],
      ['Validation', '/validation', 'K'],
      ['Export', '/export', 'X'],
    ],
  },
  {
    label: 'Operations',
    items: [
      ['Monitor', '/monitor', 'O'],
      ['Settings', '/settings', 'S'],
    ],
  },
] as const

const routeTitles: Record<string, string> = {
  '/': 'Projects',
  '/home': 'Home',
  '/dashboard': 'Dashboard',
  '/projects': 'Projects',
  '/data-sources': 'Data Sources',
  '/editor': 'Editor',
  '/alignment': 'Alignment',
  '/point-cloud': 'Point Cloud',
  '/models': 'Models',
  '/anchors': 'Anchors',
  '/devices': 'Devices',
  '/coverage': 'Coverage',
  '/pathfinding': 'Pathfinding',
  '/validation': 'Validation',
  '/export': 'Export',
  '/monitor': 'Monitor',
  '/settings': 'Settings',
}

function getRouteTitle(pathname: string): string {
  const match = Object.keys(routeTitles)
    .sort((a, b) => b.length - a.length)
    .find((path) => pathname === path || pathname.startsWith(`${path}/`))
  return match ? routeTitles[match]! : 'Spatial Twin'
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const title = useMemo(() => getRouteTitle(location.pathname), [location.pathname])

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark">ST</span>
          <div className="brand-copy">
            <strong>Spatial Twin</strong>
            <small>Security Operations</small>
          </div>
        </div>

        <nav className="nav-list">
          {navGroups.map((group) => (
            <section key={group.label} className="nav-group" aria-label={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {group.items.map(([label, to, icon]) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  title={collapsed ? label : undefined}
                >
                  <span className="nav-icon" aria-hidden="true">{icon}</span>
                  <span className="nav-text">{label}</span>
                </NavLink>
              ))}
            </section>
          ))}
        </nav>

        <button className="collapse-button" type="button" onClick={() => setCollapsed((current) => !current)}>
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div>
            <span className="topbar-kicker">Current Workspace</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions" aria-label="System status">
            <span className="status-pill">Docker Live</span>
            <span className="status-pill muted">API :8000</span>
            <span className="status-pill muted">UI :5174</span>
          </div>
        </header>

        <main className="content" id="main-content" tabIndex={-1}>
          <Suspense fallback={<div className="card">Loading...</div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
