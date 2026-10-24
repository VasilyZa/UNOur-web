import { HttpClient } from '../http'
import type { Account } from './types'
export type { Account } from './types'

export class AccountClient extends HttpClient {
  current(signal?: AbortSignal): Promise<{ user: Account }> {
    return this.request('/account', 'GET', undefined, undefined, signal)
  }
  login(username: string, password: string): Promise<{ user: Account }> {
    return this.request('/auth/login', 'POST', {
      username: username.trim(),
      password,
    })
  }
  register(username: string, password: string): Promise<{ user: Account }> {
    return this.request('/auth/register', 'POST', {
      username: username.trim(),
      password,
    })
  }
  logout(accountId: string): Promise<{ ok: boolean }> {
    return this.request(
      '/auth/logout',
      'POST',
      {},
      undefined,
      undefined,
      accountId,
    )
  }
  upload(file: Blob, accountId: string): Promise<{ user: Account }> {
    return this.request(
      '/account/avatar',
      'PUT',
      file,
      undefined,
      undefined,
      accountId,
    )
  }
  resetAvatar(accountId: string): Promise<{ user: Account }> {
    return this.request(
      '/account/avatar',
      'DELETE',
      undefined,
      undefined,
      undefined,
      accountId,
    )
  }
}
