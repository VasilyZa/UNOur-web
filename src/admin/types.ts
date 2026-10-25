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
  instance: string
  updated_at: string
  created_at: string
  host_name: string
  humans: number
  join_locked: boolean
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
  stats: {
    total: number
    lobby: number
    playing: number
    finished: number
    humans: number
  }
}
export interface RoomFilters {
  q?: string
  phase?: '' | RoomSummary['phase']
  kind?: '' | 'human' | 'bot'
  access?: '' | 'open' | 'locked'
  sort?: 'activity' | 'oldest' | 'created' | 'members'
}
export type DeleteTarget = Pick<RoomSummary, 'id' | 'instance' | 'phase'>
export type DeleteStatus = 'deleted' | 'not_found' | 'changed' | 'failed'
export interface DeleteBatch {
  deleted: number
  results: { id: string; status: DeleteStatus }[]
}
export type AdminRoom = Omit<Room, 'role' | 'revision'> & {
  role: 'admin'
  instance: string
  updated_at: string
  revision: number
  deck: Card[] | null
}
export interface CardEdit {
  instance: string
  operation: 'swap' | 'move'
  card_id: number
  replacement_id?: number
  to_player_id?: string
  expected_version: number
  expected_revision: number
}
export type CardChange = Omit<
  CardEdit,
  'instance' | 'expected_version' | 'expected_revision'
>
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
