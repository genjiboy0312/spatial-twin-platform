import { NavLink, Outlet } from 'react-router'

const navItems = [
  ['Projects', '/projects'],
  ['Data Sources', '/data-sources'],
  ['Editor', '/editor/demo'],
  ['Alignment', '/alignment'],
  ['Validation', '/validation'],
  ['Monitor', '/monitor'],
  ['Settings', '/settings'],
] as const

export function AppShell() {
  return (
    <div className="app-shell">
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
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
