import { useEffect, useState } from 'react'

export type Language = 'en' | 'ko'
export type Theme = 'dark' | 'light'

type Preferences = {
  language: Language
  theme: Theme
}

const PREFERENCES_EVENT = 'spatial-twin-preferences'

function readPreferences(): Preferences {
  return {
    language: localStorage.getItem('language') === 'ko' ? 'ko' : 'en',
    theme: localStorage.getItem('theme') === 'light' ? 'light' : 'dark',
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  localStorage.setItem(key, value)
  if (key === 'theme') {
    applyTheme(value as Theme)
  }
  window.dispatchEvent(new Event(PREFERENCES_EVENT))
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(() => readPreferences())

  useEffect(() => {
    applyTheme(preferences.theme)

    const handleChange = () => {
      const nextPreferences = readPreferences()
      applyTheme(nextPreferences.theme)
      setPreferences(nextPreferences)
    }

    window.addEventListener(PREFERENCES_EVENT, handleChange)
    window.addEventListener('storage', handleChange)
    return () => {
      window.removeEventListener(PREFERENCES_EVENT, handleChange)
      window.removeEventListener('storage', handleChange)
    }
  }, [preferences.theme])

  return preferences
}
