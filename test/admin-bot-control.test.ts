import { afterEach, expect, it, vi } from 'vitest'
import { AdminClient } from '../src/admin/api'
import { OnlineTransport } from '../src/lib/game/online'
import type { JoinResult, Room, Snapshot } from '../src/lib/game/types'
import { Member } from './client'

afterEach(() => vi.unstubAllGlobals())

it('真实 Bot 接管：无公开变更、暂停 AI、正常摸牌和退出恢复', async () => {
  const origin = process.env.UNO_TEST_ORIGIN!
  const player = new Member()
  await player.register('botctl')
  const joined = await player.request<JoinResult>('/solo', 'POST', {
    bot_count: 1,
    difficulty: 'easy',
  })
  expect(joined.status).toBe(201)
  player.seat = joined.data!
  const id = joined.data!.room.id
  const botId = joined.data!.room.state.players.find(
    (seat) => seat.id !== joined.data!.player_id,
  )!.id
  const realFetch = globalThis.fetch
  let cookie = ''
  vi.stubGlobal(
    'fetch',
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      if (new URL(String(input)).pathname.startsWith('/api/v1/admin') && cookie)
        headers.set('Cookie', cookie)
      const response = await realFetch(input, { ...init, headers })
      const adminCookie = response.headers
        .getSetCookie()
        .find((value) => value.startsWith('unour_admin='))
      if (adminCookie) cookie = adminCookie.split(';')[0]!
      return response
    },
  )
  const client = new AdminClient(origin)
  await client.login(process.env.UNO_TEST_ADMIN_PASSWORD!)
  const inspected = await client.room(id)
  const before = await player.request<Room>(`/rooms/${id}`)
  const control = await client.acquireBot(id, botId, inspected.instance)
  expect(control.room.state.you).toBe(botId)
  expect(control.room.role).toBe('player')
  expect(
    control.room.state.players.find((seat) => seat.id === botId)?.hand,
  ).toHaveLength(7)
  expect(
    control.room.state.players.find((seat) => seat.id !== botId)?.hand,
  ).toBeUndefined()
  expect((await player.request<Room>(`/rooms/${id}`)).data).toEqual(before.data)

  const { BotGameConnection } = await import('../src/admin/bot-game')
  const game = new BotGameConnection(client, control)
  const hostDraw = await player.request<{ room: Room }>(
    `/rooms/${id}/draw`,
    'POST',
    {},
  )
  expect(hostDraw.status).toBe(200)
  if (hostDraw.data!.room.state.can_pass)
    expect((await player.request(`/rooms/${id}/pass`, 'POST', {})).status).toBe(
      200,
    )
  const current = await game.read(game.session)
  expect(current.state.turn).toBe(botId)
  await new Promise((resolve) => setTimeout(resolve, 2100))
  expect((await game.read(game.session)).state.version).toBe(
    current.state.version,
  )

  const lost: unknown[] = []
  let ended!: (error: unknown) => void
  const sessionEnded = new Promise<unknown>((resolve) => {
    ended = resolve
  })
  const transport = new OnlineTransport(
    game,
    game.session,
    current,
    (error) => {
      lost.push(error)
      ended(error)
    },
  )
  let snapshot: Snapshot | undefined
  const unsubscribe = transport.subscribe((value) => {
    snapshot = value
  })
  try {
    await transport.act('draw')
    expect(
      snapshot!.room.state.players.find((seat) => seat.id === botId)
        ?.hand_count,
    ).toBe(8)
    expect(snapshot!.room.state.can_pass).toBe(true)
    await expect(transport.act('draw')).rejects.toMatchObject({ status: 409 })
    const version = snapshot!.room.state.version
    await game.leave(game.session)
    expect(await sessionEnded).toMatchObject({ code: 'bot_control_lost' })
    const deadline = Date.now() + 7000
    let resumed: Room | null = null
    while (Date.now() < deadline) {
      resumed = (await player.request<Room>(`/rooms/${id}`)).data
      if (resumed!.state.version > version) break
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    expect(resumed!.state.version).toBeGreaterThan(version)
    expect(resumed!.bots?.[botId]).toEqual(joined.data!.room.bots?.[botId])
    expect(resumed!.state.players.find((seat) => seat.id === botId)?.name).toBe(
      'Bot1',
    )
    expect(lost).toHaveLength(1)
    for (const key of [
      'lease_id',
      'bot_controls',
      'bot_control_epoch',
      'controller',
    ])
      expect(JSON.stringify(resumed)).not.toContain(`"${key}"`)
  } finally {
    unsubscribe()
    transport.dispose()
    await game.leave(game.session)
  }
}, 15000)
