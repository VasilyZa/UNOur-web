import { expect, it } from 'vitest'
import {
  buildRuleSpecs,
  createRuleSelection,
  type RuleCatalog,
} from '../src/lib/game/rules'
import type { JoinResult, Room } from '../src/lib/game/types'
import { Member } from './client'

it('真实服务提供规则元数据并冻结规范化选项', async () => {
  const member = new Member()
  const catalog = (await member.request<RuleCatalog>('/rules')).data!
  expect(catalog.revision).toMatch(/^[a-f0-9]{64}$/)
  await member.register('rules')
  const selection = createRuleSelection(catalog)
  selection.matching.options.same_color = false
  selection.stacking.enabled = true
  selection.stacking.options.mixed = true
  selection.challenge.options.failure_multiplier = 200
  const rules = buildRuleSpecs(catalog, selection)
  const created = await member.request<Room>('/rooms', 'POST', {
    rules,
    catalog_revision: catalog.revision,
  })
  expect(created.status).toBe(201)
  expect(created.data!.rules).toEqual(rules)
  expect(
    created
      .data!.rule_descriptions!.find((rule) => rule.name === 'challenge')!
      .text.join(''),
  ).toContain('2 倍')
  await member.join(created.data!.id)
  expect(
    (await member.request(`/rooms/${created.data!.id}`, 'DELETE')).status,
  ).toBe(204)
  member.seat = undefined
  const stale = await member.request('/rooms', 'POST', {
    rules,
    catalog_revision: 'outdated',
  })
  expect(stale.status).toBe(409)
})

it.skipIf(process.env.UNO_TEST_RULE_EXTENSION !== '1')(
  '新增后端 JSON 模块无需前端认识其名称，真人和 Bot 使用同一规则',
  async () => {
    const member = new Member()
    await member.register('extension')
    const catalog = (await member.request<RuleCatalog>('/rules')).data!
    const added = catalog.modules.find(
      (module) => module.name === 'extension_from_file',
    )!
    expect(added.title).toBe('配置扩展规则')
    const selection = createRuleSelection(catalog)
    selection[added.name].enabled = true
    const result = await member.request<JoinResult>('/solo', 'POST', {
      bot_count: 1,
      difficulty: 'easy',
      rules: buildRuleSpecs(catalog, selection),
      catalog_revision: catalog.revision,
    })
    expect(result.status).toBe(201)
    member.seat = result.data!
    const room = result.data!.room
    expect(
      room.rule_descriptions!.some((rule) => rule.name === added.name),
    ).toBe(true)
    expect(room.state.legal_actions!.map((action) => action.action)).toEqual([
      'draw',
    ])
    const card = room.state.players.find(
      (player) => player.id === room.state.you,
    )!.hand![0]
    expect(
      (
        await member.request(`/rooms/${room.id}/play`, 'POST', {
          card_id: card.id,
          color: 'green',
        })
      ).status,
    ).toBe(422)
    expect((await member.request(`/rooms/${room.id}`, 'DELETE')).status).toBe(
      204,
    )
  },
)

it('真实服务器拒绝绕过前端关闭所有匹配方式', async () => {
  const member = new Member()
  await member.register('bad_rules')
  const rules = [
    { name: 'matching', options: { same_color: false, same_value: false } },
    { name: 'actions' },
    { name: 'draw' },
  ]
  expect((await member.request('/rooms', 'POST', { rules })).status).toBe(400)
  expect(
    (
      await member.request('/solo', 'POST', {
        bot_count: 1,
        difficulty: 'easy',
        rules,
      })
    ).status,
  ).toBe(400)
})
