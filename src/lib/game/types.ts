export type Color = 'red' | 'yellow' | 'green' | 'blue' | 'wild'
export type PlayColor = Exclude<Color, 'wild'>
export type Kind =
  'number' | 'skip' | 'reverse' | 'draw_two' | 'wild' | 'wild_draw_four'
export type Action =
  | 'start'
  | 'play'
  | 'draw'
  | 'pass'
  | 'challenge'
  | 'uno'
  | 'uno-penalty'
  | 'rematch'
  | 'participation'
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
  uno_penalized?: number
}

export interface GameState {
  legal_actions?: { action: Action; card_id?: number; color?: PlayColor }[]
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
  finishing_player?: string
}

export type RuleScalar = boolean | number | string

export interface RuleSpec {
  version?: number
  name: string
  options?: Record<string, RuleScalar>
}

export interface Spectator {
  id: string
  name: string
  next_round: boolean
}

export interface Room {
  join_locked?: boolean
  roster_version?: number
  departed?: string[]
  role?: 'player' | 'spectator'
  spectators?: Spectator[]
  rematch_votes?: string[]
  round?: number
  revision?: number
  profiles?: Record<string, import('../account/types').Account>
  bots?: Record<string, BotSeat>
  id: string
  host_id: string
  created_at: string
  rules: RuleSpec[]
  rule_descriptions?: import('./rules').RuleDescription[]
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
  roster_version?: number
  agree?: boolean
  round?: number
  next_round?: boolean
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

/** A game screen uses the same protocol with independently authorized adapters. */
export interface GameClient {
  readonly terminalErrorCodes?: readonly string[]
  read(session: Session, signal?: AbortSignal): Promise<Room>
  action(
    session: Session,
    action: Action,
    body?: ActionBody,
    signal?: AbortSignal,
  ): Promise<{ room: Room }>
  leave(session: Session): Promise<unknown>
  dissolve(session: Session): Promise<void>
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

/** Uses the same frozen server policy as command validation. */
export function suggestsPlayable(card: Card, room: Room): boolean {
  return (
    room.state.phase === 'playing' &&
    room.state.turn === room.state.you &&
    !!room.state.legal_actions?.some(
      (action) => action.action === 'play' && action.card_id === card.id,
    )
  )
}
