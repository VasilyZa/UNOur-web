import type { Room } from '../lib/game/types'

// Transport and rule-hint unit tests use a DTO, never a simulated game engine.
export function roomFixture(): Room {
  return {
    id: 'r',
    host_id: 'you',
    created_at: '2026-10-25T00:00:00Z',
    rules: [
      { name: 'matching' },
      { name: 'actions' },
      { name: 'draw' },
      { name: 'challenge' },
    ],
    state: {
      phase: 'playing',
      version: 1,
      you: 'you',
      turn: 'you',
      players: [
        {
          id: 'you',
          name: 'Alice',
          hand_count: 2,
          hand: [
            { id: 1, color: 'red', kind: 'number', number: 7 },
            { id: 2, color: 'blue', kind: 'reverse' },
          ],
          eliminated: false,
        },
        { id: 'other', name: 'Bob', hand_count: 2, eliminated: false },
      ],
      direction: 1,
      active_color: 'red',
      top_card: { id: 3, color: 'red', kind: 'number', number: 5 },
      draw_pile_count: 103,
      discard_count: 1,
      pending_draw: 0,
      can_pass: false,
    },
  }
}
