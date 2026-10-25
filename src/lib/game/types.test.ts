import { describe, expect, it } from 'vitest'
import { roomFixture } from '../../test/room'
import { suggestsPlayable, type Room } from './types'

function roomWithPenalty(): Room {
  const room = roomFixture()
  room.rules.push({ name: 'stacking', options: { reverse: true } })
  room.state.pending_draw = 4
  room.state.pending_draw_kind = 'draw_two'
  room.state.top_card = { id: 19, kind: 'reverse', color: 'red' }
  return room
}

describe('出牌提示与后端规则保持一致', () => {
  it('摸牌后可选任意合法手牌的开关影响提示，仍拒绝不匹配的牌', () => {
    const room = roomFixture()
    room.state.can_pass = true
    room.state.drawn_card_id = 80
    const original = {
      id: 1,
      kind: 'number' as const,
      color: 'red' as const,
      number: 3,
    }
    expect(suggestsPlayable(original, room)).toBe(false)
    room.rules.find((rule) => rule.name === 'draw')!.options = {
      play_any_after_draw: true,
    }
    expect(suggestsPlayable(original, room)).toBe(true)
    expect(
      suggestsPlayable(
        { id: 2, kind: 'number', color: 'blue', number: 3 },
        room,
      ),
    ).toBe(false)
  })
  it('仅同数字模式下，万能牌后的指定颜色仍可接牌', () => {
    const room = roomFixture()
    room.rules[0].options = { same_color: false, same_value: true }
    room.state.top_card = { id: 101, kind: 'wild', color: 'wild' }
    expect(
      suggestsPlayable(
        { id: 1, kind: 'number', color: 'red', number: 3 },
        room,
      ),
    ).toBe(true)
    expect(
      suggestsPlayable(
        { id: 2, kind: 'number', color: 'blue', number: 3 },
        room,
      ),
    ).toBe(false)
  })
  it('关闭质疑后，持有当前颜色时不提示可以出 +4', () => {
    const room = roomFixture()
    room.rules = [{ name: 'matching' }, { name: 'actions' }, { name: 'draw' }]
    room.state.players[0].hand = [
      { id: 1, kind: 'number', color: 'red', number: 2 },
      { id: 108, kind: 'wild_draw_four', color: 'wild' },
    ]
    expect(suggestsPlayable(room.state.players[0].hand[1], room)).toBe(false)
    room.rules.push({ name: 'challenge' })
    expect(suggestsPlayable(room.state.players[0].hand[1], room)).toBe(true)
    room.rules.pop()
    room.state.players[0].hand[0].color = 'blue'
    expect(suggestsPlayable(room.state.players[0].hand[1], room)).toBe(true)
  })
  it('缺少 matching 规则时不凭默认值提示普通牌可出', () => {
    const room = roomFixture()
    room.rules = [{ name: 'actions' }]
    expect(
      suggestsPlayable(
        { id: 1, kind: 'number', color: 'red', number: 3 },
        room,
      ),
    ).toBe(false)
  })
  it('叠加反转可接在异色反转上', () => {
    expect(
      suggestsPlayable(
        { id: 44, kind: 'reverse', color: 'blue' },
        roomWithPenalty(),
      ),
    ).toBe(true)
  })
  it('异色加二仍独立受 different_colors 控制', () => {
    const room = roomWithPenalty()
    expect(
      suggestsPlayable({ id: 44, kind: 'draw_two', color: 'blue' }, room),
    ).toBe(false)
    room.rules.at(-1)!.options!.different_colors = true
    expect(
      suggestsPlayable({ id: 44, kind: 'draw_two', color: 'blue' }, room),
    ).toBe(true)
  })
})
