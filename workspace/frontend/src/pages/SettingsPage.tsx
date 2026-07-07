import { useEffect, useState } from 'react'

import { setPreference, usePreferences, type Language, type Theme } from '../app/preferences'
import { PageHeader } from './PageHeader'

const LABELS = {
  en: {
    title: 'Settings',
    description: 'Manage API, language, units, theme, and coordinate preferences for the workspace.',
    api: 'API base URL',
    units: 'Units',
    language: 'Language',
    theme: 'Theme',
    meters: 'Meters',
    feet: 'Feet',
    dark: 'Dark mode',
    light: 'Light mode',
    english: 'English',
    korean: 'Korean',
  },
  ko: {
    title: '설정',
    description: '워크스페이스의 API, 언어, 단위, 테마, 좌표 설정을 관리합니다.',
    api: 'API 기본 URL',
    units: '단위',
    language: '언어',
    theme: '테마',
    meters: '미터',
    feet: '피트',
    dark: '다크 모드',
    light: '라이트 모드',
    english: '영어',
    korean: '한국어',
  },
} as const

export function SettingsPage() {
  const { language, theme } = usePreferences()
  const [apiBaseUrl, setApiBaseUrl] = useState(() => localStorage.getItem('apiBaseUrl') ?? 'http://localhost:8000')
  const [units, setUnits] = useState(() => localStorage.getItem('units') ?? 'meters')
  const labels = LABELS[language]

  useEffect(() => {
    localStorage.setItem('apiBaseUrl', apiBaseUrl)
    localStorage.setItem('units', units)
  }, [apiBaseUrl, units])

  return (
    <section className="page-grid" style={{ maxWidth: 760 }}>
      <PageHeader eyebrow="System" title={labels.title} description={labels.description} />

      <div className="card settings-card">
        <label className="settings-field">
          {labels.language}
          <select
            className="select-input"
            value={language}
            onChange={(event) => setPreference('language', event.target.value as Language)}
          >
            <option value="en">{labels.english}</option>
            <option value="ko">{labels.korean}</option>
          </select>
        </label>

        <label className="settings-field">
          {labels.theme}
          <select className="select-input" value={theme} onChange={(event) => setPreference('theme', event.target.value as Theme)}>
            <option value="dark">{labels.dark}</option>
            <option value="light">{labels.light}</option>
          </select>
        </label>

        <label className="settings-field">
          {labels.api}
          <input className="text-input" value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} type="url" />
        </label>

        <label className="settings-field">
          {labels.units}
          <select className="select-input" value={units} onChange={(event) => setUnits(event.target.value)}>
            <option value="meters">{labels.meters}</option>
            <option value="feet">{labels.feet}</option>
          </select>
        </label>
      </div>
    </section>
  )
}
