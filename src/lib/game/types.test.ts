import { expect, it } from 'vitest'
import { roomFixture } from '../../test/room'
import { allowedWildColors } from './rules'
import { suggestsPlayable } from './types'

it('only highlights the commands advertised by the server, including unknown policies', () => {
  const room = roomFixture()
  const card = {
    id: 1,
    kind: 'number' as const,
    color: 'red' as const,
    number: 3,
  }
  room.rules = [{ name: 'unknown_policy' }]
  room.state.legal_actions = []
  expect(suggestsPlayable(card, room)).toBe(false)
  room.state.legal_actions = [{ action: 'play', card_id: 1 }]
  expect(suggestsPlayable(card, room)).toBe(true)
  room.state.turn = 'other'
  expect(suggestsPlayable(card, room)).toBe(false)
})
it('uses legal colors of the selected card instead of rule-specific assumptions', () => {
  const room = roomFixture()
  const card = { id: 105, color: 'wild' as const, kind: 'wild' as const }
  room.state.legal_actions = [
    { action: 'play', card_id: 105, color: 'green' },
    { action: 'play', card_id: 106, color: 'red' },
  ]
  expect(allowedWildColors(room, card)).toEqual(['green'])
  expect(allowedWildColors(room, null)).toEqual([])
})
