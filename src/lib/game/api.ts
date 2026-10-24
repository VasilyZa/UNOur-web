import type {
  Action,
  ActionBody,
  JoinResult,
  Room,
  RuleSpec,
  Session,
} from './types'

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 0,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const messages: Record<string, string> = {
  not_your_turn: '还没轮到你，稍等一下。',
  version_conflict: '牌局刚刚有变化，已刷新，请重新选择。',
  room_not_found: '没有找到这个房间，请检查房间号。',
  unauthorized: '房间凭证已失效，请重新加入。',
  invalid_token: '房间凭证已失效，请重新加入。',
  rule_rejected: '这张牌暂时不能出，试试另一张。',
  card_not_playable: '这张牌暂时不能出，试试另一张。',
  card_not_owned: '你的手牌刚刚有变化，请重新选择。',
  rule_violation: '这个操作不符合本局规则，换一种试试。',
  invalid_state: '牌局状态不支持这个操作，请查看当前回合后重试。',
  invalid_input: '填写的信息不符合要求，请检查后重试。',
  forbidden: '这个操作需要由房主完成。',
  capacity_exceeded: '牌桌暂时坐满了，请稍后再来。',
  uno_too_early: 'UNO 窗口尚未结束。',
  uno_window_closed: '这个 UNO 窗口已经结束。',
  uno_window_invalid: '这个 UNO 窗口已经结束。',
  uno_expired: '已经错过了喊 UNO 的时间，下次记得早点喊。',
  network_error: '暂时连不上牌桌，请检查网络后重试。',
  origin_not_allowed: '当前地址还没有获得牌桌的连接许可，请联系房主。',
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return messages[error.code] ?? error.message
  return '操作没有完成，请稍后重试。'
}

export class ApiClient {
  private readonly origin: string

  constructor(origin = import.meta.env.VITE_API_ORIGIN || '') {
    this.origin = origin.replace(/\/+$/, '')
  }

  private async request<T>(
    path: string,
    method: string,
    body?: unknown,
    token?: string,
    signal?: AbortSignal,
  ): Promise<T> {
    const abort = new AbortController()
    const cancel = () => abort.abort()
    if (signal?.aborted) cancel()
    signal?.addEventListener('abort', cancel, { once: true })
    const timeout = setTimeout(cancel, 8000)
    try {
      const response = await fetch(`${this.origin}/api/v1${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: abort.signal,
        cache: 'no-store',
      })
      const data = await response.json().catch(() => null)
      if (!response.ok)
        throw new ApiError(
          data?.error?.code || 'server_error',
          data?.error?.message || '服务暂时不可用，请稍后重试。',
          response.status,
        )
      if (!data)
        throw new ApiError('invalid_response', '服务器返回了无法识别的数据。')
      return data as T
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (signal?.aborted) throw new ApiError('cancelled', '请求已取消。')
      throw new ApiError('network_error', messages.network_error)
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', cancel)
    }
  }

  create(rules?: RuleSpec[]): Promise<Room> {
    return this.request('/rooms', 'POST', rules ? { rules } : {})
  }

  join(roomId: string, name: string): Promise<JoinResult> {
    return this.request(
      `/rooms/${encodeURIComponent(roomId)}/players`,
      'POST',
      { name },
    )
  }

  read(session: Session, signal?: AbortSignal): Promise<Room> {
    return this.request(
      `/rooms/${encodeURIComponent(session.roomId)}`,
      'GET',
      undefined,
      session.token,
      signal,
    )
  }

  action(
    session: Session,
    action: Action,
    body: ActionBody = {},
    signal?: AbortSignal,
  ): Promise<{ room: Room }> {
    return this.request(
      `/rooms/${encodeURIComponent(session.roomId)}/${action}`,
      'POST',
      body,
      session.token,
      signal,
    )
  }
}
