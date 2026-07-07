import { useEffect, useState } from 'react'
import { PageHeader } from './PageHeader'

type Language = 'en' | 'ko'

const LABELS: Record<Language, { title: string; description: string; api: string; units: string; language: string }> = {
  en: {
    title: 'Settings',
    description: 'Manage API, language, units, and coordinate preferences for the workspace.',
    api: 'API base URL',
    units: 'Units',
    language: 'Language',
  },
  ko: {
    title: '설정',
    description: '워크스페이스의 API, 언어, 단위, 좌표 설정을 관리합니다.',
    api: 'API 기본 URL',
    units: '단위',
    language: '언어',
  },
}

export function SettingsPage() {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') === 'ko' ? 'ko' : 'en'))
  const [apiBaseUrl, setApiBaseUrl] = useState(() => localStorage.getItem('apiBaseUrl') ?? 'http://localhost:8000')
  const [units, setUnits] = useState(() => localStorage.getItem('units') ?? 'meters')
  const labels = LABELS[language]

  useEffect(() => {
    localStorage.setItem('language', language)
    localStorage.setItem('apiBaseUrl', apiBaseUrl)
    localStorage.setItem('units', units)
  }, [apiBaseUrl, language, units])

  return (
    <section className="page-grid" style={{ maxWidth: 760 }}>
      <PageHeader eyebrow="System" title={labels.title} description={labels.description} />

      <div className="card" style={{ borderRadius: 14 }}>
        <label style={{ color: '#94a3b8', display: 'grid', gap: 6, marginBottom: 14 }}>
          {labels.language}
          <select className="select-input" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
            <option value="en">English</option>
            <option value="ko">한국어</option>
          </select>
        </label>

        <label style={{ color: '#94a3b8', display: 'grid', gap: 6, marginBottom: 14 }}>
          {labels.api}
          <input className="text-input" value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} type="url" />
        </label>

        <label style={{ color: '#94a3b8', display: 'grid', gap: 6 }}>
          {labels.units}
          <select className="select-input" value={units} onChange={(event) => setUnits(event.target.value)}>
            <option value="meters">Meters</option>
            <option value="feet">Feet</option>
          </select>
        </label>
      </div>
    </section>
  )
}
