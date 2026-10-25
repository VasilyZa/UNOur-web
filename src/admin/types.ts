import type { Account } from '../lib/account/types'
import type { Card, Room } from '../lib/game/types'

export interface AdminSession {
  expires_at: string
  csrf: string
}
export interface ManagedUser extends Account {
  disabled: boolean
  active_sessions: number
}
export interface UserPage {
  users: ManagedUser[]
  total: number
}
export interface RoomSummary {
  id: string
  phase: 'lobby' | 'playing' | 'finished'
  players: number
  spectators: number
  bots: number
  round: number
  revision: number
}
export interface RoomPage {
  rooms: RoomSummary[]
  total: number
}
export type AdminRoom = Omit<Room, 'role' | 'revision'> & {
  role: 'admin'
  revision: number
  deck: Card[] | null
}
export interface CardEdit {
  operation: 'swap' | 'move'
  card_id: number
  replacement_id?: number
  to_player_id?: string
  expected_version: number
  expected_revision: number
}
export interface AuditEntry {
  id: number
  at: string
  action: string
  target: string
  detail: string
}
export interface AuditPage {
  entries: AuditEntry[]
  total: number
}
export const phaseNames = {
  lobby: '等待开局',
  playing: '进行中',
  finished: '已结束',
}
