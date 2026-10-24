export type ThemePreference = 'system' | 'light' | 'dark'
export type Theme = Exclude<ThemePreference, 'system'>
export const themeKey = 'unour.theme'

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): Theme {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
}

export function readTheme(storage?: Pick<Storage, 'getItem'>): ThemePreference {
  try {
    const value = (storage ?? localStorage).getItem(themeKey)
    if (value === 'light' || value === 'dark') return value
  } catch {
    /* 存储受限时继续使用系统外观。 */
  }
  return 'system'
}

export function saveTheme(
  preference: ThemePreference,
  storage?: Pick<Storage, 'setItem'>,
): void {
  try {
    ;(storage ?? localStorage).setItem(themeKey, preference)
  } catch {
    /* 主题切换不依赖存储可用性。 */
  }
}

export function applyTheme(
  preference: ThemePreference,
  systemDark: boolean,
): void {
  const theme = resolveTheme(preference, systemDark)
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#15171b' : '#f3f4f6')
}
