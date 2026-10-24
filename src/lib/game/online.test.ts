import { afterEach, describe, expect, it, vi } from 'vitest'
import { OnlineTransport } from './online'
import { roomFixture } from '../../test/room'
import { ApiError } from './api'
import type { Room, Session } from './types'

const session: Session = {
  roomId: 'r',
  playerId: 'you',
  token: 'private',
  accountId: 'account',
}
const fixture = roomFixture
afterEach(() => vi.useRealTimers())

describe('联机传输生命周期', () => {
  it('销毁后迟到的认证错误不能清除新的会话', async () => {
    vi.useFakeTimers()
    let reject!: (error: Error) => void
    const lost = vi.fn()
    const api = {
      read: vi.fn(
        () =>
          new Promise<Room>((_resolve, fail) => {
            reject = fail
          }),
      ),
      action: vi.fn(),
    }
    const online = new OnlineTransport(api, session, fixture(), lost)
    online.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(900)
    online.dispose()
    reject(new ApiError('account_unauthorized', 'expired', 401))
    await Promise.resolve()
    expect(lost).not.toHaveBeenCalled()
  })

  it('迟到的旧轮询不能覆盖已提交的新版本', async () => {
    vi.useFakeTimers()
    const initial = fixture()
    const updated = structuredClone(initial)
    updated.state.version++
    let resolve!: (room: Room) => void
    const api = {
      read: vi.fn().mockImplementation(
        () =>
          new Promise<Room>((done) => {
            resolve = done
          }),
      ),
      action: vi.fn().mockResolvedValue({ room: updated }),
    }
    const online = new OnlineTransport(api, session, initial)
    const versions: number[] = []
    online.subscribe((snapshot) => versions.push(snapshot.room.state.version))
    await vi.advanceTimersByTimeAsync(900)
    await online.act('draw')
    resolve(initial)
    await Promise.resolve()
    expect(versions).toEqual([1, 2])
    expect(api.action.mock.calls[0][2]).toEqual({ expected_version: 1 })
    online.dispose()
  })

  it('网络错误只刷新状态，不重发命令；UNO 不携带全房间版本', async () => {
    const room = fixture()
    const api = {
      read: vi.fn().mockResolvedValue(room),
      action: vi
        .fn()
        .mockRejectedValueOnce(new ApiError('network_error', 'offline'))
        .mockResolvedValue({ room }),
    }
    const online = new OnlineTransport(api, session, room)
    await expect(online.act('draw')).rejects.toMatchObject({
      code: 'network_error',
    })
    expect(api.action).toHaveBeenCalledTimes(1)
    expect(api.read).toHaveBeenCalledOnce()
    await online.act('uno', { window_id: 7 })
    expect(api.action.mock.calls[1][2]).toEqual({ window_id: 7 })
    online.dispose()
  })

  it('销毁会取消在途请求、计时器和后续更新', async () => {
    vi.useFakeTimers()
    let signal!: AbortSignal
    let resolve!: (room: Room) => void
    const api = {
      read: vi.fn().mockImplementation((_session, input) => {
        signal = input
        return new Promise<Room>((done) => {
          resolve = done
        })
      }),
      action: vi.fn(),
    }
    const room = fixture()
    const online = new OnlineTransport(api, session, room)
    const listener = vi.fn()
    online.subscribe(listener)
    await vi.advanceTimersByTimeAsync(900)
    online.dispose()
    expect(signal.aborted).toBe(true)
    resolve({ ...room, state: { ...room.state, version: 99 } })
    await vi.advanceTimersByTimeAsync(10000)
    expect(api.read).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledOnce()
  })
})
