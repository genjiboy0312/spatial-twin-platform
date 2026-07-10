import { lazy } from 'react'
import { createBrowserRouter } from 'react-router'

import { AppShell } from './shell/AppShell'

const AlignmentPage = lazy(() => import('../pages/AlignmentPage').then((module) => ({ default: module.AlignmentPage })))
const AnchorsPage = lazy(() => import('../pages/AnchorsPage').then((module) => ({ default: module.AnchorsPage })))
const CoveragePage = lazy(() => import('../pages/CoveragePage').then((module) => ({ default: module.CoveragePage })))
const DashboardPage = lazy(() => import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const DataSourcesPage = lazy(() => import('../pages/DataSourcesPage').then((module) => ({ default: module.DataSourcesPage })))
const DevicesPage = lazy(() => import('../pages/DevicesPage').then((module) => ({ default: module.DevicesPage })))
const EditorPage = lazy(() => import('../pages/EditorPage').then((module) => ({ default: module.EditorPage })))
const ExportPage = lazy(() => import('../pages/ExportPage').then((module) => ({ default: module.ExportPage })))
const HomePage = lazy(() => import('../pages/HomePage').then((module) => ({ default: module.HomePage })))
const LoginPage = lazy(() => import('../pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const ModelsPage = lazy(() => import('../pages/ModelsPage').then((module) => ({ default: module.ModelsPage })))
const MonitorPage = lazy(() => import('../pages/MonitorPage').then((module) => ({ default: module.MonitorPage })))
const PathfindingPage = lazy(() => import('../pages/PathfindingPage').then((module) => ({ default: module.PathfindingPage })))
const PointCloudPage = lazy(() => import('../pages/PointCloudPage').then((module) => ({ default: module.PointCloudPage })))
const ProjectsPage = lazy(() => import('../pages/ProjectsPage').then((module) => ({ default: module.ProjectsPage })))
const SettingsPage = lazy(() => import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const ValidationPage = lazy(() => import('../pages/ValidationPage').then((module) => ({ default: module.ValidationPage })))

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: LoginPage,
  },
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, Component: HomePage },
      { path: 'home', Component: HomePage },
      { path: 'dashboard', Component: DashboardPage },
      { path: 'projects', Component: ProjectsPage },
      { path: 'data-sources', Component: DataSourcesPage },
      { path: 'editor/:buildingId?', Component: EditorPage },
      { path: 'alignment', Component: AlignmentPage },
      { path: 'anchors', Component: AnchorsPage },
      { path: 'point-cloud', Component: PointCloudPage },
      { path: 'models', Component: ModelsPage },
      { path: 'devices', Component: DevicesPage },
      { path: 'coverage', Component: CoveragePage },
      { path: 'pathfinding', Component: PathfindingPage },
      { path: 'validation', Component: ValidationPage },
      { path: 'export', Component: ExportPage },
      { path: 'monitor', Component: MonitorPage },
      { path: 'settings', Component: SettingsPage },
    ],
  },
])
