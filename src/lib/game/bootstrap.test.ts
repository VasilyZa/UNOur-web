import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import { restoreRoomSession, sessionForInvitation } from './bootstrap'
import type { Room, Session } from './types'

const session: Session = { roomId: 'r', playerId: 'me', token: 'private' }

describe('会话恢复边界', () => {
  it('同房间邀请优先复用座位，不同房间邀请不恢复旧房间', () => {
    expect(sessionForInvitation(session, 'r')).toBe(session)
    expect(sessionForInvitation(session, null)).toBe(session)
    expect(sessionForInvitation(session, 'other')).toBeNull()
  })

  it('旧恢复请求迟到返回 401 时，不删除新入座凭证', async () => {
    let reject!: (reason: unknown) => void
    let current = true
    const read = vi.fn().mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail
        }),
    )
    const restored = vi.fn(),
      failed = vi.fn(),
      forget = vi.fn()
    const promise = restoreRoomSession({ read }, session, {
      isCurrent: () => current,
      restored,
      failed,
      forget,
    })
    current = false
    reject(new ApiError('unauthorized', 'expired', 401))
    await promise
    expect(forget).not.toHaveBeenCalled()
    expect(failed).not.toHaveBeenCalled()
  })

  it('仍属于当前恢复的失效会话才清除；网络故障保留凭证', async () => {
    const forget = vi.fn(),
      failed = vi.fn()
    const callbacks = {
      isCurrent: () => true,
      restored: vi.fn(),
      failed,
      forget,
    }
    await restoreRoomSession(
      {
        read: vi
          .fn()
          .mockRejectedValue(new ApiError('network_error', 'offline')),
      },
      session,
      callbacks,
    )
    expect(forget).not.toHaveBeenCalled()
    await restoreRoomSession(
      {
        read: vi
          .fn()
          .mockRejectedValue(new ApiError('unauthorized', 'expired', 401)),
      },
      session,
      callbacks,
    )
    expect(forget).toHaveBeenCalledOnce()
    expect(failed).toHaveBeenCalledTimes(2)
  })

  it('成功的旧响应也不能覆盖新牌桌', async () => {
    const restored = vi.fn()
    await restoreRoomSession(
      { read: vi.fn().mockResolvedValue({} as Room) },
      session,
      { isCurrent: () => false, restored, failed: vi.fn(), forget: vi.fn() },
    )
    expect(restored).not.toHaveBeenCalled()
  })
})
