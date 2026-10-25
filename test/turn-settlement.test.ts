import { expect, it } from 'vitest'
import {
  buildRuleSpecs,
  createRuleSelection,
  type RuleCatalog,
} from '../src/lib/game/rules'
import type { AdminRoom, AdminSession, CardChange } from '../src/admin/types'
import type { Action, Card, Color, Kind, Room } from '../src/lib/game/types'
import { Member } from './client'

// Use only the real administration boundary to arrange physical cards. No
// fixture endpoint, simulated game or intercepted API response is involved.
class LiveAdmin {
  private cookie = ''
  private csrf = ''
  async request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(
      `${process.env.UNO_TEST_ORIGIN}/api/v1/admin${path}`,
      {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Cookie: this.cookie,
          ...(body === undefined
            ? {}
            : {
                'Content-Type': 'application/json',
                'X-Admin-CSRF': this.csrf,
              }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      },
    )
    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith('unour_admin='))
    if (cookie) this.cookie = cookie.split(';')[0]
    expect(response.status).toBe(200)
    return response.json() as Promise<T>
  }
  async login() {
    const session = await this.request<AdminSession>('/login', {
      password: process.env.UNO_TEST_ADMIN_PASSWORD,
    })
    this.csrf = session.csrf
  }
}
let administration: Promise<LiveAdmin> | undefined
function liveAdmin() {
  administration ??= (async () => {
    const admin = new LiveAdmin()
    await admin.login()
    return admin
  })()
  return administration
}
async function table(count = 2) {
  const players = Array.from({ length: count }, () => new Member())
  for (const [i, player] of players.entries()) await player.register(`turn${i}`)
  const catalog = (await players[0].request<RuleCatalog>('/rules')).data!
  const options = createRuleSelection(catalog)
  options.actions.options.skip_draw = true
  options.draw.options.play_any_after_draw = true
  options.stacking.enabled = true
  Object.assign(options.stacking.options, {
    reverse: true,
    mixed: true,
    different_colors: true,
  })
  const created = await players[0].request<Room>('/rooms', 'POST', {
    rules: buildRuleSpecs(catalog, options),
    catalog_revision: catalog.revision,
  })
  expect(created.status).toBe(201)
  const path = `/rooms/${created.data!.id}`
  for (const player of players) await player.join(created.data!.id)
  expect((await players[0].request(`${path}/start`, 'POST', {})).status).toBe(
    200,
  )
  const admin = await liveAdmin()
  let managed = await admin.request<AdminRoom>(path)
  const cards = () => [
    ...(managed.deck ?? []),
    ...managed.state.players.flatMap((player) => player.hand ?? []),
  ]
  const choose = (kind: Kind, color?: Color, except: number[] = []) => {
    const card = cards().find(
      (card) =>
        card.kind === kind &&
        (!color || card.color === color) &&
        !except.includes(card.id),
    )
    expect(card).toBeTruthy()
    return card!
  }
  async function edit(change: CardChange) {
    managed = await admin.request<AdminRoom>(`${path}/cards`, {
      ...change,
      instance: managed.instance,
      expected_version: managed.state.version,
      expected_revision: managed.revision,
    })
  }
  async function pin(player: Member, wanted: Card[]) {
    const ids = wanted.map((card) => card.id),
      id = player.seat!.player_id
    for (const card of wanted) {
      const held = managed.state.players.find(
        (player) => player.id === id,
      )!.hand!
      if (!held.some((value) => value.id === card.id))
        await edit({
          operation: 'swap',
          card_id: held.find((value) => !ids.includes(value.id))!.id,
          replacement_id: card.id,
        })
    }
    const held = managed.state.players.find((player) => player.id === id)!.hand!
    for (const card of held.filter((card) => !ids.includes(card.id)))
      await edit({ operation: 'move', card_id: card.id })
  }
  const read = async (player: Member) => {
    const response = await player.request<Room>(path)
    expect(response.status).toBe(200)
    return response.data!
  }
  const act = (player: Member, action: Action, room: Room, body: object = {}) =>
    player.request<{ room: Room }>(`${path}/${action}`, 'POST', {
      ...body,
      expected_version: room.state.version,
    })
  return {
    players,
    path,
    pin,
    choose,
    read,
    act,
    color: managed.state.active_color!,
  }
}

it('真实服务：最后 +2 自动结算，刷新后仍获胜，双方都不能继续摸牌', async () => {
  const t = await table(),
    [a, b] = t.players
  const final = t.choose('draw_two', t.color)
  await t.pin(a, [final])
  const before = await t.read(a),
    count = before.state.players.find(
      (player) => player.id === b.seat!.player_id,
    )!.hand_count
  expect((await t.act(a, 'play', before, { card_id: final.id })).status).toBe(
    200,
  )
  const after = await t.read(a)
  expect(after.state.phase).toBe('finished')
  expect(after.state.winner).toBe(a.seat!.player_id)
  expect(
    after.state.players.find((player) => player.id === b.seat!.player_id)!
      .hand_count,
  ).toBe(count + 2)
  for (const player of [a, b])
    expect((await t.act(player, 'draw', after)).status).toBe(409)
})

it.each(['draw', 'challenge'] as const)(
  '真实服务：最后 +4 只能 %s 结算，不能反转或叠加回空手玩家',
  async (resolution) => {
    const t = await table(),
      [a, b] = t.players
    const final = t.choose('wild_draw_four'),
      color = t.color === 'blue' ? 'green' : 'blue'
    const reverse = t.choose('reverse', color),
      stack = t.choose('wild_draw_four', undefined, [final.id]),
      number = t.choose('number', color)
    await t.pin(a, [final])
    await t.pin(b, [reverse, stack, number])
    expect(
      (await t.act(a, 'play', await t.read(a), { card_id: final.id, color }))
        .status,
    ).toBe(200)
    const closing = await t.read(b)
    expect(closing.state.finishing_player).toBe(a.seat!.player_id)
    expect(
      closing.state.legal_actions!.map((action) => action.action).sort(),
    ).toEqual(['challenge', 'draw'])
    for (const card of [reverse, stack])
      expect(
        (
          await t.act(b, 'play', closing, {
            card_id: card.id,
            ...(card.color === 'wild' ? { color: t.color } : {}),
          })
        ).status,
      ).toBe(409)
    expect((await t.act(b, resolution, closing)).status).toBe(200)
    const after = await t.read(a)
    expect(after.state.phase).toBe('finished')
    expect(after.state.winner).toBe(a.seat!.player_id)
    expect(
      after.state.players.find((player) => player.id === b.seat!.player_id)!
        .hand_count,
    ).toBe(resolution === 'draw' ? 7 : 9)
  },
)

it('真实服务：被禁后只罚摸一张，不能出任意牌、手动再摸或跳过', async () => {
  const t = await table(3),
    [a, b, c] = t.players
  const skip = t.choose('skip', t.color),
    first = t.choose('number', t.color),
    second = t.choose('number', t.color, [first.id])
  await t.pin(a, [skip, first, second])
  const before = await t.read(a),
    count = before.state.players.find(
      (player) => player.id === b.seat!.player_id,
    )!.hand_count
  expect((await t.act(a, 'play', before, { card_id: skip.id })).status).toBe(
    200,
  )
  const skipped = await t.read(b)
  expect(skipped.state.turn).toBe(c.seat!.player_id)
  expect(skipped.state.legal_actions).toEqual([])
  const me = skipped.state.players.find(
    (player) => player.id === b.seat!.player_id,
  )!
  expect(me.hand_count).toBe(count + 1)
  for (const action of ['draw', 'play', 'pass'] as const)
    expect(
      (
        await t.act(b, action, skipped, {
          ...(action === 'play' ? { card_id: me.hand![0].id } : {}),
        })
      ).status,
    ).toBe(409)
  const after = await t.read(b)
  expect(after.state.version).toBe(skipped.state.version)
  expect(
    after.state.players.find((player) => player.id === b.seat!.player_id)!
      .hand_count,
  ).toBe(count + 1)
})

it('真实服务：并发重复普通摸牌只提交一次，不传版本也不能再摸', async () => {
  const t = await table(),
    [a] = t.players,
    before = await t.read(a)
  const count = before.state.players.find(
    (player) => player.id === a.seat!.player_id,
  )!.hand_count
  const results = await Promise.all([
    t.act(a, 'draw', before),
    t.act(a, 'draw', before),
  ])
  expect(results.map((result) => result.status).sort()).toEqual([200, 409])
  const after = await t.read(a)
  expect(after.state.can_pass).toBe(true)
  expect(
    after.state.players.find((player) => player.id === a.seat!.player_id)!
      .hand_count,
  ).toBe(count + 1)
  expect((await a.request(`${t.path}/draw`, 'POST', {})).status).toBe(409)
  expect((await t.read(a)).state.version).toBe(after.state.version)
})

it('真实服务：漏喊 UNO 罚摸幂等，罚摸与一次正常摸牌有不同含义', async () => {
  const t = await table(),
    [a, b] = t.players
  const first = t.choose('number', t.color),
    second = t.choose('number', t.color, [first.id])
  await t.pin(a, [first, second])
  expect(
    (await t.act(a, 'play', await t.read(a), { card_id: first.id })).status,
  ).toBe(200)
  expect((await t.act(b, 'draw', await t.read(b))).status).toBe(200)
  expect((await t.act(b, 'pass', await t.read(b))).status).toBe(200)
  const current = await t.read(a),
    window = current.state.players.find(
      (player) => player.id === a.seat!.player_id,
    )!.uno!
  await new Promise((resolve) =>
    setTimeout(
      resolve,
      Math.max(0, Date.parse(window.deadline) - Date.now()) + 50,
    ),
  )
  for (let i = 0; i < 2; i++)
    expect(
      (
        await a.request(`${t.path}/uno-penalty`, 'POST', {
          window_id: window.id,
        })
      ).status,
    ).toBe(200)
  const penalized = await t.read(a),
    me = penalized.state.players.find(
      (player) => player.id === a.seat!.player_id,
    )!
  expect(me.hand_count).toBe(2)
  expect(me.uno_penalized).toBe(window.id)
  expect((await t.act(a, 'draw', penalized)).status).toBe(200)
  const drawn = await t.read(a)
  expect(
    drawn.state.players.find((player) => player.id === a.seat!.player_id)!
      .hand_count,
  ).toBe(3)
  expect((await a.request(`${t.path}/draw`, 'POST', {})).status).toBe(409)
})
