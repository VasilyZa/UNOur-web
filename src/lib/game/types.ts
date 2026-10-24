export type Color = 'red' | 'yellow' | 'green' | 'blue' | 'wild'
export type PlayColor = Exclude<Color, 'wild'>
export type Kind =
  'number' | 'skip' | 'reverse' | 'draw_two' | 'wild' | 'wild_draw_four'
export type Action =
  'start' | 'play' | 'draw' | 'pass' | 'challenge' | 'uno' | 'uno-penalty'
export type BotDifficulty = 'easy' | 'normal' | 'hard' | 'expert'
export type BotStyle = 'balanced' | 'aggressive' | 'cautious'

export interface BotSeat {
  difficulty: BotDifficulty
  style: BotStyle
}

export interface Card {
  id: number
  color: Color
  kind: Kind
  number?: number
}

export interface UNOWindow {
  id: number
  deadline: string
}

export interface Player {
  id: string
  name: string
  hand_count: number
  hand?: Card[]
  eliminated: boolean
  uno?: UNOWindow
  /** 已成功声明的 UNO 窗口编号；用于跨轮询识别和去重。 */
  uno_declared?: number
}

export interface GameState {
  phase: 'lobby' | 'playing' | 'finished'
  version: number
  you: string
  players: Player[]
  turn?: string
  direction: number
  top_card?: Card
  active_color?: Color
  draw_pile_count: number
  discard_count: number
  pending_draw: number
  pending_draw_kind?: Kind
  challenge_target?: string
  drawn_card_id?: number
  can_pass: boolean
  winner?: string
}

export interface RuleSpec {
  name: string
  options?: Record<string, boolean | number>
}

export interface Room {
  profiles?: Record<string, import('../account/types').Account>
  bots?: Record<string, BotSeat>
  id: string
  host_id: string
  created_at: string
  rules: RuleSpec[]
  state: GameState
}

export interface Session {
  accountId: string
  roomId: string
  token: string
  playerId: string
}

export interface JoinResult {
  player_id: string
  token: string
  room: Room
}

export const botDifficultyNames: Record<BotDifficulty, string> = {
  easy: '简单',
  normal: '标准',
  hard: '困难',
  expert: '专家',
}

export interface ActionBody {
  card_id?: number
  color?: PlayColor | 'keep'
  window_id?: number
  expected_version?: number
}

export interface Snapshot {
  room: Room
  connection: 'connected' | 'reconnecting'
}

export interface GameTransport {
  subscribe(listener: (snapshot: Snapshot) => void): () => void
  act(action: Action, body?: ActionBody): Promise<void>
  dispose(): void
}

export const colorNames: Record<Color, string> = {
  red: '红色',
  yellow: '黄色',
  green: '绿色',
  blue: '蓝色',
  wild: '万能',
}

export function cardSymbol(card: Card): string {
  return {
    skip: '⊘',
    reverse: '⇄',
    draw_two: '+2',
    wild: '✦',
    wild_draw_four: '+4',
    number: String(card.number ?? 0),
  }[card.kind]
}

export function cardName(card: Card): string {
  const name = {
    number: `${card.number ?? 0}`,
    skip: '跳过',
    reverse: '反转',
    draw_two: '加二',
    wild: '换色牌',
    wild_draw_four: '加四',
  }[card.kind]
  return `${colorNames[card.color]}${name}`
}

/** 仅为界面提示，最终是否合法始终以服务器规则结算为准。 */
export function suggestsPlayable(card: Card, room: Room): boolean {
  const state = room.state
  if (state.phase !== 'playing' || state.turn !== state.you) return false
  if (state.can_pass && state.drawn_card_id && card.id !== state.drawn_card_id)
    return false
  if (state.pending_draw) {
    const stacking = room.rules.find((rule) => rule.name === 'stacking')
    if (!stacking) return false
    const sameColor = card.color === 'wild' || card.color === state.active_color
    if (card.kind === 'reverse')
      return (
        !!stacking.options?.reverse &&
        (sameColor || state.top_card?.kind === 'reverse')
      )
    return (
      ['draw_two', 'wild_draw_four'].includes(card.kind) &&
      (!!stacking.options?.mixed || card.kind === state.pending_draw_kind) &&
      (!!stacking.options?.different_colors || sameColor)
    )
  }
  const matching = room.rules.find((rule) => rule.name === 'matching')?.options
  return (
    card.color === 'wild' ||
    (matching?.same_color !== false && card.color === state.active_color) ||
    (matching?.same_value !== false &&
      card.kind === state.top_card?.kind &&
      (card.kind !== 'number' ||
        (card.number ?? 0) === (state.top_card.number ?? 0)))
  )
}
