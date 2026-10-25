import { ApiError, HttpClient } from '../lib/http'
import type {
  AdminRoom,
  AdminSession,
  AuditPage,
  CardEdit,
  RoomPage,
  UserPage,
} from './types'

// Only CSRF is held in memory. The administrator cookie remains HttpOnly.
export class AdminClient extends HttpClient {
  private csrf = ''
  private async admin<T>(
    path: string,
    method = 'GET',
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    try {
      return await this.request(
        `/admin${path}`,
        method,
        body,
        undefined,
        signal,
        undefined,
        method === 'GET' ? {} : { 'X-Admin-CSRF': this.csrf },
      )
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) this.csrf = ''
      throw error
    }
  }
  async current(signal?: AbortSignal): Promise<AdminSession> {
    const session = await this.admin<AdminSession>(
      '/session',
      'GET',
      undefined,
      signal,
    )
    this.csrf = session.csrf
    return session
  }
  async login(password: string): Promise<AdminSession> {
    const session = await this.admin<AdminSession>('/login', 'POST', {
      password,
    })
    this.csrf = session.csrf
    return session
  }
  async logout(): Promise<void> {
    try {
      await this.admin('/logout', 'POST', {})
    } finally {
      this.csrf = ''
    }
  }
  users(q = '', offset = 0, signal?: AbortSignal): Promise<UserPage> {
    return this.admin(
      `/users?${new URLSearchParams({ q, offset: String(offset), limit: '20' })}`,
      'GET',
      undefined,
      signal,
    )
  }
  status(id: string, disabled: boolean): Promise<void> {
    return this.admin(`/users/${encodeURIComponent(id)}/status`, 'PUT', {
      disabled,
    })
  }
  revoke(id: string): Promise<void> {
    return this.admin(`/users/${encodeURIComponent(id)}/revoke`, 'POST', {})
  }
  resetPassword(id: string, password: string): Promise<void> {
    return this.admin(`/users/${encodeURIComponent(id)}/password`, 'PUT', {
      password,
    })
  }
  rooms(offset = 0, signal?: AbortSignal): Promise<RoomPage> {
    return this.admin(
      `/rooms?offset=${offset}&limit=20`,
      'GET',
      undefined,
      signal,
    )
  }
  room(id: string, signal?: AbortSignal): Promise<AdminRoom> {
    return this.admin(
      `/rooms/${encodeURIComponent(id)}`,
      'GET',
      undefined,
      signal,
    )
  }
  edit(id: string, body: CardEdit): Promise<AdminRoom> {
    return this.admin(`/rooms/${encodeURIComponent(id)}/cards`, 'POST', body)
  }
  audit(offset = 0, signal?: AbortSignal): Promise<AuditPage> {
    return this.admin(
      `/audit?offset=${offset}&limit=20`,
      'GET',
      undefined,
      signal,
    )
  }
}
