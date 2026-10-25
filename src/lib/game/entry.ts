import type { JoinResult, Room, RuleSpec } from './types'

export interface LobbyAPI {
  create(accountId: string, rules?: RuleSpec[]): Promise<Room>
  join(
    roomId: string,
    accountId: string,
    spectate?: boolean,
  ): Promise<JoinResult>
}

type RoomEntryRequest = Readonly<{
  mode: 'create' | 'join'
  roomId: string
  spectate: boolean
  rules?: RuleSpec[]
}>

export async function joinFromLobby(
  api: LobbyAPI,
  accountId: string,
  request: RoomEntryRequest,
  onCreated?: (id: string) => void,
): Promise<JoinResult> {
  if (request.mode === 'join')
    return api.join(request.roomId.trim(), accountId, request.spectate)

  const room = await api.create(accountId, request.rules)
  onCreated?.(room.id)
  // Creation always seats the creator, independent of retained form values.
  return api.join(room.id, accountId, false)
}
