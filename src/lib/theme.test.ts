import { describe, expect, it } from 'vitest'
import { readTheme, resolveTheme, saveTheme } from './theme'

describe('主题偏好', () => {
  it('仅跟随系统时响应系统外观，显式选择不会被覆盖', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('读取已保存的偏好，无效或不可用的存储回退为跟随系统', () => {
    expect(readTheme({ getItem: () => 'dark' })).toBe('dark')
    expect(readTheme({ getItem: () => 'invalid' })).toBe('system')
    expect(
      readTheme({
        getItem: () => {
          throw new Error('blocked')
        },
      }),
    ).toBe('system')
  })

  it('存储受限不会阻断主题切换', () => {
    expect(() =>
      saveTheme('light', {
        setItem: () => {
          throw new Error('blocked')
        },
      }),
    ).not.toThrow()
  })
})
