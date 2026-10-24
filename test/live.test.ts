import { expect, it } from 'vitest'
import process from 'node:process'
import { readFile } from 'node:fs/promises'
import type { Account } from '../src/lib/account/types'
import type { JoinResult, Room } from '../src/lib/game/types'

const origin = process.env.UNO_TEST_ORIGIN || 'http://127.0.0.1:8088'
class Client {
  cookie = ''
  async request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
    token?: string,
    expectedAccountId?: string,
  ) {
    const response = await fetch(`${origin}/api/v1${path}`, {
      method,
      headers: {
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(body === undefined
          ? {}
          : {
              'Content-Type':
                body instanceof Blob ? body.type : 'application/json',
            }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(expectedAccountId ? { 'X-Account-ID': expectedAccountId } : {}),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof Blob
            ? body
            : JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith('unour_account='))
    if (cookie) this.cookie = cookie.split(';')[0]
    const data = response.status === 204 ? null : ((await response.json()) as T)
    return { status: response.status, data, cookie }
  }
}

it('真实服务器：注册边界、账户隔离、头像、开局、重入与注销', async () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const alice = new Client(),
    bob = new Client()
  const username = `a_${suffix}`,
    other = `b_${suffix}`
  expect(
    (
      await alice.request('/auth/register', 'POST', {
        username,
        password: '1234567',
      })
    ).status,
  ).toBe(400)
  expect(
    (
      await alice.request('/auth/register', 'POST', {
        username,
        password: '123456789012345',
      })
    ).status,
  ).toBe(400)
  const registered = await alice.request<{ user: Account }>(
    '/auth/register',
    'POST',
    { username, password: '12345678' },
  )
  expect(registered.status).toBe(201)
  expect(registered.cookie).toContain('HttpOnly')
  expect(registered.cookie).toContain('SameSite=Lax')
  expect(JSON.stringify(registered.data)).not.toContain('password')
  expect(
    (
      await bob.request('/auth/register', 'POST', {
        username: username.toUpperCase(),
        password: '12345678',
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await bob.request('/auth/register', 'POST', {
        username: other,
        password: '12345678901234',
      })
    ).status,
  ).toBe(201)
  expect(
    (
      await bob.request(
        '/rooms',
        'POST',
        {},
        undefined,
        registered.data!.user.id,
      )
    ).status,
  ).toBe(401)
  const created = await alice.request<Room>('/rooms', 'POST', {})
  expect(created.status).toBe(201)
  const path = `/rooms/${created.data!.id}`
  const seat = (await alice.request<JoinResult>(`${path}/players`, 'POST', {}))
    .data!
  const second = (await bob.request<JoinResult>(`${path}/players`, 'POST', {}))
    .data!
  const started = await alice.request<{ room: Room }>(
    `${path}/start`,
    'POST',
    {},
    seat.token,
  )
  expect(started.status).toBe(200)
  expect(
    started.data!.room.state.players.find((p) => p.id === seat.player_id)?.hand,
  ).toHaveLength(7)
  expect(
    started.data!.room.state.players.find((p) => p.id === second.player_id)
      ?.hand,
  ).toBeUndefined()
  expect((await bob.request(path, 'GET', undefined, seat.token)).status).toBe(
    401,
  )
  const image = await readFile(
    new URL('./fixtures/avatar.png', import.meta.url),
  )
  const uploaded = await alice.request<{ user: Account }>(
    '/account/avatar',
    'PUT',
    new Blob([image], { type: 'image/png' }),
  )
  expect(uploaded.status).toBe(200)
  const avatarPath = uploaded.data!.user.avatar_url
  expect(
    (await fetch(`${origin}${avatarPath}`)).headers.get('Content-Type'),
  ).toBe('image/png')
  const view = (await bob.request<Room>(path, 'GET', undefined, second.token))
    .data!
  expect(view.profiles?.[seat.player_id].avatar_url).toBe(avatarPath)
  expect(view.state.version).toBe(started.data!.room.state.version)
  const rejoined = (
    await alice.request<JoinResult>(`${path}/players`, 'POST', {})
  ).data!
  expect(rejoined.player_id).toBe(seat.player_id)
  expect(rejoined.room.state.players).toHaveLength(2)
  expect((await alice.request(path, 'GET', undefined, seat.token)).status).toBe(
    401,
  )
  expect((await alice.request('/account/avatar', 'DELETE')).status).toBe(200)
  expect((await alice.request('/auth/logout', 'POST', {})).status).toBe(200)
  expect((await alice.request('/account')).status).toBe(401)
  expect(
    (await alice.request(path, 'GET', undefined, rejoined.token)).status,
  ).toBe(401)
  expect(
    (
      await alice.request('/auth/login', 'POST', {
        username,
        password: 'wrongpass',
      })
    ).status,
  ).toBe(401)
  expect(
    (
      await alice.request('/auth/login', 'POST', {
        username,
        password: '12345678',
      })
    ).status,
  ).toBe(200)
  expect(
    (await alice.request(path, 'GET', undefined, rejoined.token)).status,
  ).toBe(200)
  expect(
    (await alice.request(path, 'DELETE', undefined, rejoined.token)).status,
  ).toBe(204)
}, 20000)
