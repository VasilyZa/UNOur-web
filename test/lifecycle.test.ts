import { expect, it } from 'vitest'
import type { Room } from '../src/lib/game/types'

import { Member } from './client'

it('真实服务器：局中观战、下局入座、全员同意、退出转交和解散', async () => {
  const [a, b, c, d] = [new Member(), new Member(), new Member(), new Member()]
  for (const [i, member] of [a, b, c, d].entries())
    await member.register(`life${i}`)
  const created = await a.request<Room>('/rooms', 'POST', {})
  expect(created.status).toBe(201)
  const id = created.data!.id,
    path = `/rooms/${id}`
  await a.join(id)
  await b.join(id)
  expect((await a.request(`${path}/start`, 'POST', {})).status).toBe(200)
  const observer = await c.join(id, true),
    queued = await d.join(id)
  expect(observer.role).toBe('spectator')
  expect(queued.state.players).toHaveLength(2)
  expect(
    queued.spectators?.find((p) => p.id === d.seat!.player_id)?.next_round,
  ).toBe(true)
  for (const member of [c, d]) {
    const read = await member.request<Room>(path)
    for (const p of read.data!.state.players) expect(p.hand).toBeUndefined()
    expect((await member.request(`${path}/draw`, 'POST', {})).status).toBe(403)
  }
  expect(
    (
      await c.request(`${path}/rematch`, 'POST', {
        agree: true,
        round: 1,
        roster_version: 3,
      })
    ).status,
  ).toBe(409)
  expect((await b.request(`${path}/leave`, 'POST', {})).status).toBe(200)
  const finished = await a.request<Room>(path)
  expect(finished.data!.state.phase).toBe('finished')
  expect(
    (
      await c.request(`${path}/rematch`, 'POST', {
        agree: true,
        round: 1,
        roster_version: 4,
      })
    ).status,
  ).toBe(403)
  const stale = await a.request(`${path}/rematch`, 'POST', {
    agree: true,
    round: 1,
    roster_version: 3,
  })
  expect(stale.status).toBe(409)
  let vote = await a.request<Room>(`${path}/rematch`, 'POST', {
    agree: true,
    round: 1,
    roster_version: 4,
  })
  expect(vote.data!.state.phase).toBe('finished')
  expect(vote.data!.rematch_votes).toEqual([a.seat!.player_id])
  vote = await a.request<Room>(`${path}/rematch`, 'POST', {
    agree: false,
    round: 1,
    roster_version: 4,
  })
  expect(vote.data!.rematch_votes).toEqual([])
  await a.request(`${path}/rematch`, 'POST', {
    agree: true,
    round: 1,
    roster_version: 4,
  })
  const restarted = await d.request<Room>(`${path}/rematch`, 'POST', {
    agree: true,
    round: 1,
    roster_version: 4,
  })
  expect(restarted.status).toBe(200)
  expect(restarted.data!.round).toBe(2)
  expect(restarted.data!.state.phase).toBe('playing')
  expect(restarted.data!.role).toBe('player')
  expect(restarted.data!.state.players).toHaveLength(2)
  expect(
    restarted.data!.state.players.find((p) => p.id === d.seat!.player_id)?.hand,
  ).toHaveLength(7)
  expect(
    (
      await d.request(`${path}/rematch`, 'POST', {
        agree: true,
        round: 1,
        roster_version: 4,
      })
    ).status,
  ).toBe(409)
  await a.request(`${path}/leave`, 'POST', {})
  const transferred = await d.request<Room>(path)
  expect(transferred.data!.host_id).toBe(d.seat!.player_id)
  expect((await c.request(path, 'DELETE')).status).toBe(403)
  expect((await d.request(path, 'DELETE')).status).toBe(204)
  expect((await c.request(path)).status).toBe(404)
}, 20000)
