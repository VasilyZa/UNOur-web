import { expect } from 'vitest'
import type { JoinResult } from '../src/lib/game/types'

const origin = process.env.UNO_TEST_ORIGIN!
export class Member {
  accountId = ''
  cookie = ''
  seat?: JoinResult
  async request<T>(path: string, method = 'GET', body?: unknown) {
    const response = await fetch(`${origin}/api/v1${path}`, {
      method,
      headers: {
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(this.accountId ? { 'X-Account-ID': this.accountId } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(this.seat ? { Authorization: `Bearer ${this.seat.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })
    const cookie = response.headers
      .getSetCookie()
      .find((v) => v.startsWith('unour_account='))
    if (cookie) this.cookie = cookie.split(';')[0]
    return {
      status: response.status,
      data: response.status === 204 ? null : ((await response.json()) as T),
    }
  }
  async register(label: string) {
    const name = `${label}_${crypto.randomUUID().replaceAll('-', '').slice(0, 14)}`
    const response = await this.request<{ user: { id: string } }>(
      '/auth/register',
      'POST',
      { username: name, password: '12345678' },
    )
    expect(response.status).toBe(201)
    this.accountId = response.data!.user.id
  }

  async join(id: string, watch = false) {
    const result = await this.request<JoinResult>(
      `/rooms/${id}/${watch ? 'spectators' : 'players'}`,
      'POST',
      {},
    )
    expect(result.status).toBe(201)
    this.seat = result.data!
    return result.data!.room
  }
}
