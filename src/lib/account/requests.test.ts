import { describe, expect, it } from 'vitest'
import { AccountRequests } from './requests'

describe('账户请求生命周期', () => {
  it('旧账户查询晚到不能覆盖新登录的账户', async () => {
    const requests = new AccountRequests()
    let finish!: (value: string) => void
    const applied: string[] = []
    const restore = requests.restore(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
      (value) => {
        applied.push(value)
      },
    )
    await requests.authenticate(
      async () => 'B',
      (value) => {
        applied.push(value)
      },
    )
    finish('A')
    await restore
    expect(applied).toEqual(['B'])
  })
  it('认证进行时不再启动旧 Cookie 的查询', async () => {
    const requests = new AccountRequests()
    let finish!: (value: string) => void
    const applied: string[] = []
    const login = requests.authenticate(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
      (value) => {
        applied.push(value)
      },
    )
    let queried = false
    await requests.restore(
      async () => {
        queried = true
        return 'A'
      },
      (value) => {
        applied.push(value)
      },
    )
    finish('B')
    await login
    expect(queried).toBe(false)
    expect(applied).toEqual(['B'])
  })
  it('注销或销毁之后的迟到结果不会再发布', async () => {
    const requests = new AccountRequests()
    let finish!: (value: string) => void
    let published = false
    const restore = requests.restore(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
      () => {
        published = true
      },
    )
    requests.invalidate()
    finish('A')
    await restore
    expect(published).toBe(false)
  })
})
