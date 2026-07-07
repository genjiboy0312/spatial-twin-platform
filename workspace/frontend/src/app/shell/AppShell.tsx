import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router'

const navItems = [
  ['Projects', '/projects'],
  ['Data Sources', '/data-sources'],
  ['Editor', '/editor/demo'],
  ['Alignment', '/alignment'],
  ['Point Cloud', '/point-cloud'],
  ['Coverage', '/coverage'],
  ['Pathfinding', '/pathfinding'],
  ['Validation', '/validation'],
  ['Export', '/export'],
  ['Monitor', '/monitor'],
  ['Settings', '/settings'],
] as const

export function AppShell() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark">BE</span>
          <div>
            <strong>Building Editor</strong>
            <small>Prototype</small>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map(([label, to]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content" id="main-content" tabIndex={-1}>
        <Suspense fallback={<div className="card">Loading...</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
