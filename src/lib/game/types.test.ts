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
