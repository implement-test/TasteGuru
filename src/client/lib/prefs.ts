import { useCallback, useSyncExternalStore } from 'react'

// 기기별 화면 설정. 브라우저 저장소에 두고, 저장이 막혀도 기본값으로 동작한다.
export type Theme = 'system' | 'light' | 'dark'
export type FontSize = 'sm' | 'md' | 'lg' | 'xl'

const THEME_KEY = 'tg-theme'
const FONT_KEY = 'tg-font-size'
const listeners = new Set<() => void>()

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* 저장 불가(시크릿 모드 등) — 이번 방문에만 적용 */
  }
}

export function getTheme(): Theme {
  const v = read(THEME_KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

export function getFontSize(): FontSize {
  const v = read(FONT_KEY)
  return v === 'sm' || v === 'lg' || v === 'xl' ? v : 'md'
}

let current = { theme: getTheme(), fontSize: getFontSize() }

function apply() {
  const root = document.documentElement
  if (current.theme === 'system') delete root.dataset.theme
  else root.dataset.theme = current.theme
  if (current.fontSize === 'md') delete root.dataset.fontSize
  else root.dataset.fontSize = current.fontSize
}

export function setTheme(theme: Theme) {
  current = { ...current, theme }
  write(THEME_KEY, theme === 'system' ? null : theme)
  apply()
  listeners.forEach((l) => l())
}

export function setFontSize(fontSize: FontSize) {
  current = { ...current, fontSize }
  write(FONT_KEY, fontSize === 'md' ? null : fontSize)
  apply()
  listeners.forEach((l) => l())
}

export function usePrefs() {
  const subscribe = useCallback((l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }, [])
  const prefs = useSyncExternalStore(subscribe, () => current)
  return { ...prefs, setTheme, setFontSize }
}
