import { ApiClient, ApiError } from './api'
import type { Room, Session } from './types'

export function sessionForInvitation(
  session: Session | null,
  invitation: string | null,
): Session | null {
  return session && (!invitation || invitation === session.roomId)
    ? session
    : null
}

/** 所有恢复副作用共享同一生命周期门闩，过期请求不能清除或覆盖新会话。 */
export async function restoreRoomSession(
  api: Pick<ApiClient, 'read'>,
  session: Session,
  callbacks: {
    isCurrent: () => boolean
    restored: (room: Room) => void
    failed: (error: unknown) => void
    forget: () => void
  },
): Promise<void> {
  try {
    const room = await api.read(session)
    if (callbacks.isCurrent()) callbacks.restored(room)
  } catch (error) {
    if (!callbacks.isCurrent()) return
    if (error instanceof ApiError && [401, 404].includes(error.status))
      callbacks.forget()
    callbacks.failed(error)
  }
}
