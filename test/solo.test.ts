import { expect, it } from 'vitest'
import process from 'node:process'
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
    accountId?: string,
  ) {
    const response = await fetch(`${origin}/api/v1${path}`, {
      method,
      headers: {
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(accountId ? { 'X-Account-ID': accountId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })
    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith('unour_account='))
    if (cookie) this.cookie = cookie.split(';')[0]
    const data = response.status === 204 ? null : await response.json()
    return { status: response.status, data: data as T }
  }
}

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

it('真实服务器：校验人机配置、隐藏电脑手牌并在真人行动后自动推进电脑回合', async () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const client = new Client()
  const registered = await client.request<{ user: Account }>(
    '/auth/register',
    'POST',
    { username: `solo_${suffix}`, password: '12345678' },
  )
  expect(registered.status).toBe(201)
  const accountId = registered.data!.user.id

  for (const body of [
    { bot_count: 0, difficulty: 'normal' },
    { bot_count: 10, difficulty: 'easy' },
    { bot_count: 1, difficulty: 'unknown' },
  ]) {
    expect(
      (await client.request('/solo', 'POST', body, undefined, accountId))
        .status,
    ).toBe(400)
  }

  const joined = await client.request<JoinResult>(
    '/solo',
    'POST',
    { bot_count: 1, difficulty: 'easy' },
    undefined,
    accountId,
  )
  expect(joined.status).toBe(201)
  const result = joined.data!
  const room = result.room
  const bots = room.bots ?? {}
  expect(room.state.phase).toBe('playing')
  expect(Object.keys(bots)).toHaveLength(1)
  const botIds = Object.keys(bots)
  expect(bots[botIds[0]]).toEqual(
    expect.objectContaining({ difficulty: 'easy' }),
  )
  expect(['balanced', 'aggressive', 'cautious']).toContain(
    bots[botIds[0]].style,
  )
  expect(
    room.state.players.find((player) => player.id === result.player_id)?.hand,
  ).toHaveLength(7)
  for (const player of room.state.players) {
    if (botIds.includes(player.id)) expect(player.hand).toBeUndefined()
  }

  expect(room.state.turn).toBe(result.player_id)
  const drawn = await client.request<{ room: Room }>(
    `/rooms/${room.id}/draw`,
    'POST',
    { expected_version: room.state.version },
    result.token,
    accountId,
  )
  expect(drawn.status).toBe(200)
  expect(drawn.data!.room.state.you).toBe(result.player_id)
  expect(drawn.data!.room.state.can_pass).toBe(true)
  expect(
    drawn.data!.room.state.players.find(
      (player) => player.id === result.player_id,
    )?.hand,
  ).toHaveLength(8)

  const passed = await client.request<{ room: Room }>(
    `/rooms/${room.id}/pass`,
    'POST',
    { expected_version: drawn.data!.room.state.version },
    result.token,
    accountId,
  )
  expect(passed.status).toBe(200)
  const humanTurnVersion = passed.data!.room.state.version
  expect(humanTurnVersion).toBeGreaterThan(drawn.data!.room.state.version)
  expect(passed.data!.room.state.turn).toBe(botIds[0])

  const botHandCount = room.state.players.find(
    (player) => player.id === botIds[0],
  )!.hand_count
  const deadline = Date.now() + 18000
  let botAction: Room | null = null
  while (Date.now() < deadline) {
    const latest = await client.request<Room>(
      `/rooms/${room.id}`,
      'GET',
      undefined,
      result.token,
      accountId,
    )
    expect(latest.status).toBe(200)
    const current = latest.data!
    const computer = current.state.players.find(
      (player) => player.id === botIds[0],
    )
    const changedHand = computer?.hand_count !== botHandCount
    const changedTop =
      current.state.top_card?.id !== passed.data!.room.state.top_card?.id
    if (
      current.state.version > humanTurnVersion &&
      (changedHand || changedTop)
    ) {
      botAction = current
      break
    }
    await pause(250)
  }

  expect(botAction).not.toBeNull()
  expect(botAction!.state.version).toBeGreaterThan(humanTurnVersion)
}, 25000)
