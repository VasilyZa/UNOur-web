import { expect, it } from 'vitest'
import {
  buildRuleSpecs,
  defaultRuleOptions,
  readRuleOptions,
} from '../src/lib/game/rules'
import type { JoinResult, Room } from '../src/lib/game/types'
import { Member } from './client'

it('真实服务器保存房间规则，并在人机与普通房间一致应用', async () => {
  const member = new Member()
  await member.register('rules')
  const selection = {
    ...defaultRuleOptions(),
    sameColor: false,
    stacking: true,
    mixedStacking: true,
    skipDraw: true,
    reverseStacking: true,
    keepColor: true,
    doubleChallengePenalty: true,
    differentColorStacking: true,
    playAnyAfterDraw: true,
  }
  const rules = buildRuleSpecs(selection)
  const created = await member.request<Room>('/rooms', 'POST', { rules })
  expect(created.status).toBe(201)
  await member.join(created.data!.id)
  const read = await member.request<Room>(`/rooms/${created.data!.id}`)
  expect(read.status).toBe(200)
  expect(readRuleOptions(read.data!.rules)).toEqual(selection)
  expect(
    (await member.request(`/rooms/${created.data!.id}`, 'DELETE')).status,
  ).toBe(204)
  member.seat = undefined

  selection.challenge = false
  selection.sameColor = true
  selection.sameValue = false
  const solo = await member.request<JoinResult>('/solo', 'POST', {
    bot_count: 1,
    difficulty: 'easy',
    rules: buildRuleSpecs(selection),
  })
  expect(solo.status).toBe(201)
  expect(solo.data!.room.state.phase).toBe('playing')
  expect(readRuleOptions(solo.data!.room.rules)).toMatchObject({
    sameColor: true,
    sameValue: false,
    challenge: false,
    mixedStacking: true,
    skipDraw: true,
    reverseStacking: true,
    keepColor: true,
    differentColorStacking: true,
    playAnyAfterDraw: true,
  })
  expect(solo.data!.room.rules.some((rule) => rule.name === 'challenge')).toBe(
    false,
  )
  member.seat = solo.data!
  expect(
    (await member.request(`/rooms/${solo.data!.room.id}`, 'DELETE')).status,
  ).toBe(204)
})

it('真实服务器拒绝绕过前端同时关闭两个匹配选项', async () => {
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
