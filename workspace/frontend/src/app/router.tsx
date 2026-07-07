import { createBrowserRouter } from 'react-router'

import { AppShell } from './shell/AppShell'
import { AlignmentPage } from '../pages/AlignmentPage'
import { DataSourcesPage } from '../pages/DataSourcesPage'
import { EditorPage } from '../pages/EditorPage'
import { MonitorPage } from '../pages/MonitorPage'
import { ProjectsPage } from '../pages/ProjectsPage'
import { SettingsPage } from '../pages/SettingsPage'
import { ValidationPage } from '../pages/ValidationPage'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, Component: ProjectsPage },
      { path: 'projects', Component: ProjectsPage },
      { path: 'data-sources', Component: DataSourcesPage },
      { path: 'editor/:buildingId?', Component: EditorPage },
      { path: 'alignment', Component: AlignmentPage },
      { path: 'validation', Component: ValidationPage },
      { path: 'monitor', Component: MonitorPage },
      { path: 'settings', Component: SettingsPage },
    ],
  },
])
