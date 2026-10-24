import type { Session } from './types'

const key = 'unour.session.v2'

export function readSession(): Session | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null')
    if (
      value &&
      ['roomId', 'token', 'playerId', 'accountId'].every(
        (field) => typeof value[field] === 'string' && value[field].length > 0,
      )
    )
      return value
  } catch {
    /* 受限存储或无效缓存不影响登录与重新加入房间。 */
  }
  return null
}

export function saveSession(session: Session | null): boolean {
  try {
    if (session) localStorage.setItem(key, JSON.stringify(session))
    else localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

// A stale tab may only forget the seat it actually held, never a newer seat
// that another tab has since saved for a different account.
export function forgetSession(expected: Session): void {
  if (readSession()?.token === expected.token) saveSession(null)
}
