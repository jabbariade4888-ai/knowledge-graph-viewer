import { useCallback, useEffect, useState } from 'react'
import { presetGpnDark, presetGpnDefault, type ThemePreset } from '@consta/uikit/Theme'

export type AppThemeMode = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'kb-graph-theme'

export function readStoredTheme(): AppThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Ignore storage access errors and fall back to system preference.
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function themePreset(mode: AppThemeMode): ThemePreset {
  return mode === 'dark' ? presetGpnDark : presetGpnDefault
}

export function useAppTheme() {
  const [mode, setMode] = useState<AppThemeMode>(() => {
    if (typeof window === 'undefined') return 'light'
    return readStoredTheme()
  })

  useEffect(() => {
    document.documentElement.dataset.theme = mode
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode)
    } catch {
      // Preference persistence is optional.
    }
  }, [mode])

  const toggleTheme = useCallback(() => {
    setMode((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { mode, setMode, toggleTheme, preset: themePreset(mode) }
}
