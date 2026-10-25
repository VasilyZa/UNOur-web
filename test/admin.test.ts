import { afterEach, expect, it, vi } from 'vitest'
import { AdminClient } from '../src/admin/api'
import { Member } from './client'
import type { JoinResult } from '../src/lib/game/types'

afterEach(() => vi.unstubAllGlobals())

it('真实管理接口：独立登录、改牌、用户封禁、撤销会话及审计', async () => {
  const origin = process.env.UNO_TEST_ORIGIN!
  const password = process.env.UNO_TEST_ADMIN_PASSWORD!
  expect(password).toBeTruthy()
  const player = new Member()
  await player.register('admin')
  const joined = await player.request<JoinResult>('/solo', 'POST', {
    bot_count: 1,
    difficulty: 'easy',
  })
  expect(joined.status).toBe(201)
  const roomId = joined.data!.room.id
  const realFetch = globalThis.fetch
  let cookie = ''
  // A cookie jar for Node; every request still reaches the real Go/SQLite service.
  vi.stubGlobal(
    'fetch',
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      if (cookie && !headers.has('Cookie')) headers.set('Cookie', cookie)
      const response = await realFetch(input, { ...init, headers })
      const value = response.headers
        .getSetCookie()
        .find((v) => v.startsWith('unour_admin='))
      if (value) cookie = value.split(';')[0]!
      return response
    },
  )
  const client = new AdminClient(origin)
  await expect(client.rooms()).rejects.toMatchObject({ status: 401 })
  const session = await client.login(password)
  expect(session.csrf).toBeTruthy()
  const listed = await client.rooms()
  expect(listed.rooms.some((r) => r.id === roomId)).toBe(true)
  const before = await client.room(roomId)
  expect(before.state.players.every((p) => p.hand?.length === 7)).toBe(true)
  const source = before.state.players[0]!.hand![0]!
  const replacement = before.deck![0]!
  const edited = await client.edit(roomId, {
    instance: before.instance,
    operation: 'swap',
    card_id: source.id,
    replacement_id: replacement.id,
    expected_version: before.state.version,
    expected_revision: before.revision,
  })
  expect(edited.state.players[0]!.hand![0]!.id).toBe(replacement.id)
  await expect(
    client.edit(roomId, {
      instance: before.instance,
      operation: 'move',
      card_id: replacement.id,
      expected_version: before.state.version,
      expected_revision: before.revision,
    }),
  ).rejects.toMatchObject({ status: 409 })
  // Exercise administrative controls against the same live Go/SQLite process.
  const locked = await client.access(roomId, before.instance, true)
  expect(locked.join_locked).toBe(true)
  const visitor = new Member()
  await visitor.register('adminv')
  expect(
    (await visitor.request(`/rooms/${roomId}/spectators`, 'POST', {})).status,
  ).toBe(403)
  await client.access(roomId, before.instance, false)
  await visitor.join(roomId, true)
  const withVisitor = await client.access(roomId, before.instance, true)
  const kicked = await client.kick(
    roomId,
    visitor.seat!.player_id,
    withVisitor.instance,
  )
  expect(kicked.spectators).toHaveLength(0)
  const botId = Object.keys(kicked.bots ?? {})[0]!
  await expect(
    client.kick(roomId, botId, before.instance),
  ).rejects.toMatchObject({ status: 409 })
  expect((await visitor.request(`/rooms/${roomId}`)).status).toBe(401)
  await expect(
    client.kick(roomId, joined.data!.player_id, before.instance),
  ).rejects.toMatchObject({ status: 409 })
  const roomFilter = await client.rooms({
    q: roomId,
    access: 'locked',
    kind: 'bot',
    phase: 'playing',
  })
  expect(roomFilter.total).toBe(1)
  expect(roomFilter.rooms[0]!.instance).toBe(before.instance)
  const temporary = `bulk_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`
  expect(
    (await player.request('/rooms', 'POST', { id: temporary })).status,
  ).toBe(201)
  const lobby = await client.room(temporary)
  const batch = await client.deleteRooms([
    { id: temporary, instance: lobby.instance, phase: lobby.state.phase },
    { id: `${temporary}_missing`, instance: lobby.instance, phase: 'lobby' },
  ])
  expect(batch.deleted).toBe(1)
  expect(batch.results.map((r) => r.status)).toEqual(['deleted', 'not_found'])
  await expect(client.room(temporary)).rejects.toMatchObject({ status: 404 })
  expect(
    (await player.request('/rooms', 'POST', { id: temporary })).status,
  ).toBe(201)
  const stale = await client.deleteRooms([
    { id: temporary, instance: lobby.instance, phase: 'lobby' },
  ])
  expect(stale.results[0]!.status).toBe('changed')
  expect((await client.room(temporary)).instance).not.toBe(lobby.instance)
  const users = await client.users('admin')
  const user = users.users.find((u) => u.id === player.accountId)!
  expect(user).toBeTruthy()
  await client.status(user.id, true)
  expect((await player.request('/account')).status).toBe(401)
  expect((await client.users(user.username)).users[0]!.disabled).toBe(true)
  await client.status(user.id, false)
  expect((await player.request('/account')).status).toBe(401)
  await client.resetPassword(user.id, 'changed-pass')
  await client.revoke(user.id)
  const audit = await client.audit()
  expect(
    audit.entries.some(
      (entry) => entry.action === 'room.cards' && entry.target === roomId,
    ),
  ).toBe(true)
  expect(JSON.stringify(audit)).not.toContain('password_hash')
  await client.logout()
  await expect(client.room(roomId)).rejects.toMatchObject({ status: 401 })
}, 15000)
