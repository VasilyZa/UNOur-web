import { afterEach, expect, it, vi } from 'vitest'
import { LiveResource } from './live.svelte'

afterEach(() => vi.unstubAllGlobals())

it('较慢的旧读取不能覆盖刚成功提交的房间', async () => {
  vi.stubGlobal('document', { hidden: false })
  let finish!: (value: { version: number }) => void
  const resource = new LiveResource(
    () =>
      new Promise<{ version: number }>((resolve) => {
        finish = resolve
      }),
    () => {},
  )
  const pending = resource.refresh()
  resource.accept({ version: 8 })
  finish({ version: 7 })
  await pending
  expect(resource.data).toEqual({ version: 8 })
  expect(resource.loading).toBe(false)
  resource.dispose()
})

it('卸载后清空敏感数据，迟到的读取和写入回调不能恢复轮询', async () => {
  vi.stubGlobal('document', { hidden: false })
  let finish!: (value: string) => void
  const resource = new LiveResource(
    (signal) =>
      new Promise<string>((resolve) => {
        finish = resolve
        signal.addEventListener('abort', () => resolve('private hands'))
      }),
    () => {},
  )
  resource.start()
  resource.dispose()
  finish('private hands')
  await Promise.resolve()
  await Promise.resolve()
  resource.accept('late write')
  resource.start()
  expect(resource.data).toBeNull()
  expect(resource.loading).toBe(false)
})
