import { expect, it } from 'vitest'
import { joinFromLobby, type LobbyAPI } from '../src/lib/game/entry'
import type { Room } from '../src/lib/game/types'
import { Member } from './client'

// Keep authentication cookies on the real HTTP requests; no responses or
// account/room services are replaced by mocks.
function lobbyAPI(member: Member): LobbyAPI {
  return {
    create: async (_accountId, rules) => {
      const response = await member.request<Room>(
        '/rooms',
        'POST',
        rules ? { rules } : {},
      )
      expect(response.status).toBe(201)
      return response.data!
    },
    join: async (roomId, _accountId, watch) => {
      await member.join(roomId, watch)
      return member.seat!
    },
  }
}

it('真实服务器：创建房间忽略残留的仅观战值，正常加入仍支持观战', async () => {
  const creator = new Member()
  await creator.register('entry')
  let createdId = ''
  const selection = {
    mode: 'create' as 'create' | 'join',
    roomId: '',
    spectate: true,
  }
  const result = await joinFromLobby(
    lobbyAPI(creator),
    creator.accountId,
    selection,
    (id) => {
      createdId = id
      // Match the form switching to join mode after creation finishes.
      selection.mode = 'join'
    },
  )
  expect(result.room.id).toBe(createdId)
  expect(result.room.role).toBe('player')
  expect(result.room.host_id).toBe(result.player_id)
  expect(result.room.state.players).toHaveLength(1)
  expect(result.room.state.players[0].id).toBe(result.player_id)
  const viewer = new Member()
  await viewer.register('watch')
  const observed = await joinFromLobby(lobbyAPI(viewer), viewer.accountId, {
    mode: 'join',
    roomId: ` ${createdId} `,
    spectate: true,
  })
  expect(observed.room.role).toBe('spectator')
  expect(observed.room.state.players).toHaveLength(1)
  expect(observed.room.spectators?.[0].next_round).toBe(false)
  expect((await creator.request(`/rooms/${createdId}`, 'DELETE')).status).toBe(
    204,
  )
})
