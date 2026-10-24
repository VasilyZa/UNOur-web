import { ApiError } from './api'
import {
  suggestsPlayable,
  type Action,
  type ActionBody,
  type Card,
  type GameTransport,
  type PlayColor,
  type Room,
  type Snapshot,
} from './types'

const colors: PlayColor[] = ['red', 'yellow', 'green', 'blue']
const initialHand: Card[] = [
  { id: 1, color: 'red', kind: 'number', number: 7 },
  { id: 2, color: 'red', kind: 'reverse' },
  { id: 3, color: 'yellow', kind: 'number', number: 7 },
  { id: 4, color: 'green', kind: 'draw_two' },
  { id: 5, color: 'blue', kind: 'number', number: 2 },
  { id: 6, color: 'blue', kind: 'number', number: 5 },
  { id: 7, color: 'wild', kind: 'wild' },
]

/** 用于 UI 试玩的轻量场景。完整规则与持久化由 Go 后端负责。 */
export class DemoTransport implements GameTransport {
  readonly mode = 'demo' as const
  private listeners = new Set<(snapshot: Snapshot) => void>()
  private timer?: ReturnType<typeof setTimeout>
  private disposed = false
  private lastPenalty?: number
  private lastDeclaration?: number
  private nextId = 20
  private botStep = 0
  private room: Room

  constructor(scenario: 'normal' | 'uno' = 'normal') {
    const hand = structuredClone(
      scenario === 'uno' ? initialHand.slice(0, 2) : initialHand,
    )
    this.room = {
      id: 'SUNSET',
      host_id: 'you',
      created_at: new Date().toISOString(),
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
        direction: 1,
        active_color: 'red',
        top_card: { id: 0, color: 'red', kind: 'number', number: 5 },
        draw_pile_count: 108 - hand.length - 16,
        discard_count: 1,
        pending_draw: 0,
        can_pass: false,
        players: [
          {
            id: 'you',
            name: '小白',
            hand_count: hand.length,
            hand,
            eliminated: false,
          },
          { id: 'mumu', name: '沐沐', hand_count: 5, eliminated: false },
          { id: 'lin', name: '小林', hand_count: 4, eliminated: false },
          { id: 'ahe', name: '阿禾', hand_count: 6, eliminated: false },
        ],
      },
    }
  }

  subscribe(listener: (snapshot: Snapshot) => void): () => void {
    this.listeners.add(listener)
    listener({ room: structuredClone(this.room), connection: 'demo' })
    return () => this.listeners.delete(listener)
  }

  private publish(): void {
    if (this.disposed) return
    this.room.state.version++
    const snapshot: Snapshot = {
      room: structuredClone(this.room),
      connection: 'demo',
    }
    this.listeners.forEach((listener) => listener(snapshot))
  }

  private advance(steps = 1): void {
    const state = this.room.state
    const index = state.players.findIndex((p) => p.id === state.turn)
    state.turn = state.players[(index + state.direction * steps + 8) % 4].id
    state.can_pass = false
    state.drawn_card_id = undefined
    if (state.turn !== state.you) this.timer = setTimeout(() => this.bot(), 680)
  }

  private bot(): void {
    if (this.disposed || this.room.state.phase !== 'playing') return
    const state = this.room.state
    const player = state.players.find((p) => p.id === state.turn)!
    if (player.hand_count > 2 && state.draw_pile_count > 0) {
      player.hand_count--
      state.top_card = {
        id: this.nextId++,
        color: state.active_color || 'red',
        kind: 'number',
        number: (++this.botStep + 4) % 10,
      }
      state.discard_count++
    } else {
      player.hand_count++
      state.draw_pile_count = Math.max(0, state.draw_pile_count - 1)
    }
    this.advance()
    this.publish()
  }

  async act(action: Action, body: ActionBody = {}): Promise<void> {
    if (this.disposed) return
    const state = this.room.state
    const me = state.players[0]
    if (action === 'uno' || action === 'uno-penalty') {
      if (action === 'uno-penalty' && body.window_id === this.lastPenalty)
        return
      if (action === 'uno' && body.window_id === this.lastDeclaration) return
      if (!me.uno || me.uno.id !== body.window_id)
        throw new ApiError('uno_window_closed', '这个 UNO 窗口已经结束。')
      const deadline = Date.parse(me.uno.deadline)
      if (action === 'uno' && Date.now() >= deadline)
        throw new ApiError('uno_window_closed', '已经错过了喊 UNO 的时间。')
      if (action === 'uno-penalty') {
        if (Date.now() < deadline)
          throw new ApiError('uno_too_early', '还没有到处罚时间。')
        this.drawCard()
        this.lastPenalty = body.window_id
      } else this.lastDeclaration = body.window_id
      me.uno = undefined
      this.publish()
      return
    }
    if (state.turn !== state.you)
      throw new ApiError('not_your_turn', '还没有轮到你。')
    if (action === 'play') {
      const card = me.hand!.find((c) => c.id === body.card_id)
      if (!card || !suggestsPlayable(card, this.room))
        throw new ApiError('rule_rejected', '这张牌现在不能出。')
      if (card.color === 'wild' && !colors.includes(body.color as PlayColor))
        throw new ApiError('invalid_color', '请先选择颜色。')
      me.hand = me.hand!.filter((c) => c.id !== card.id)
      me.hand_count = me.hand.length
      state.top_card = card
      state.active_color =
        card.color === 'wild' ? (body.color as PlayColor) : card.color
      state.discard_count++
      me.uno =
        me.hand_count === 1
          ? {
              id: state.version + 1,
              deadline: new Date(Date.now() + 2000).toISOString(),
            }
          : undefined
      if (me.hand_count === 0) {
        state.phase = 'finished'
        state.winner = me.id
        this.publish()
        return
      }
      if (card.kind === 'reverse') state.direction *= -1
      if (card.kind === 'draw_two' || card.kind === 'wild_draw_four') {
        const index = state.players.findIndex((p) => p.id === state.turn)
        const next = state.players[(index + state.direction + 4) % 4]
        const amount = Math.min(
          state.draw_pile_count,
          card.kind === 'draw_two' ? 2 : 4,
        )
        next.hand_count += amount
        state.draw_pile_count -= amount
      }
      this.advance(
        card.kind === 'skip' ||
          card.kind === 'draw_two' ||
          card.kind === 'wild_draw_four'
          ? 2
          : 1,
      )
    } else if (action === 'draw') {
      if (state.can_pass)
        throw new ApiError('already_drawn', '已经摸过牌了，可以出牌或跳过。')
      const card = this.drawCard()
      state.can_pass = true
      state.drawn_card_id = card.id
      me.uno = undefined
    } else if (action === 'pass') {
      if (!state.can_pass)
        throw new ApiError('cannot_pass', '先摸一张牌再跳过。')
      this.advance()
    }
    this.publish()
  }

  private drawCard(): Card {
    const card: Card = {
      id: this.nextId++,
      color: colors[this.nextId % 4],
      kind: 'number',
      number: this.nextId % 10,
    }
    const me = this.room.state.players[0]
    me.hand = [...me.hand!, card]
    me.hand_count = me.hand.length
    this.room.state.draw_pile_count = Math.max(
      0,
      this.room.state.draw_pile_count - 1,
    )
    return card
  }

  dispose(): void {
    this.disposed = true
    clearTimeout(this.timer)
    this.listeners.clear()
  }
}
