import type { Session } from './types'

const key = 'unour.session.v1'

export function readSession(): Session | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null')
    if (
      value &&
      ['roomId', 'token', 'playerId'].every(
        (field) => typeof value[field] === 'string' && value[field].length > 0,
      )
    )
      return value
  } catch {
    /* 受限存储或无效缓存不影响试玩。 */
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
