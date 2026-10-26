export class ApiError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status = 0) {
    super(message)
    this.code = code
    this.status = status
    this.name = 'ApiError'
  }
}

const messages: Record<string, string> = {
  rule_catalog_changed: '规则配置已更新，请确认新的选项后重新创建。',
  admin_unauthorized: '管理会话已过期，请重新登录。',
  admin_credentials: '管理密码不正确。',
  admin_csrf: '管理凭证已变化，请刷新页面后重试。',
  bot_control_busy: '这个 Bot 正由另一个管理会话操作。',
  bot_control_lost: '此 Bot 的操作已结束，请返回房间管理。',
  bot_unavailable: '这个 Bot 当前无法操作，请刷新房间状态。',
  room_closed: '房间已解散或已过期。',
  spectator_read_only: '观战者不能操作牌局；可报名下一局。',
  spectator_required: '此操作仅适用于观战者。',
  roster_changed: '参赛名单刚刚有变化，请确认新名单后再同意。',
  rematch_unavailable: '本局尚未结束，或已开始新的一局。',
  username_taken: '这个用户名已被使用。',
  invalid_username: '用户名需为 3–24 个汉字、英文字母、数字、下划线或短横线。',
  invalid_password: '密码需为 8–14 个字符。',
  invalid_credentials: '用户名或密码不正确。',
  account_unauthorized: '登录已过期，请重新登录。',
  account_changed: '账户已在其他页面切换，已刷新登录状态。',
  invalid_avatar: '请选择有效的 PNG 或 JPEG 图片。',
  avatar_too_large: '图片不能超过 2 MiB。',
  avatar_busy: '头像处理繁忙，请稍后重试。',
  auth_rate_limited: '尝试次数较多，请五分钟后再试。',
  auth_busy: '登录服务繁忙，请稍后重试。',
  not_your_turn: '还没轮到你，稍等一下。',
  version_conflict: '牌局刚刚有变化，已刷新，请重新选择。',
  room_not_found: '没有找到这个房间，请检查房间号。',
  room_locked: '房间已锁定，暂不接受新成员。',
  member_not_found: '该成员已离开，请刷新房间。',
  last_member: '这是最后一名真人成员，请使用解散房间。',
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

export class HttpClient {
  protected readonly origin: string

  constructor(origin = import.meta.env.VITE_API_ORIGIN || '') {
    this.origin = origin.replace(/\/+$/, '')
  }

  protected async request<T>(
    path: string,
    method: string,
    body?: unknown,
    token?: string,
    signal?: AbortSignal,
    accountId?: string,
    extraHeaders: Record<string, string> = {},
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
          ...(body === undefined
            ? {}
            : {
                'Content-Type':
                  body instanceof Blob ? body.type : 'application/json',
              }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(accountId ? { 'X-Account-ID': accountId } : {}),
          ...extraHeaders,
        },
        body:
          body === undefined
            ? undefined
            : body instanceof Blob
              ? body
              : JSON.stringify(body),
        credentials: 'include',
        signal: abort.signal,
        cache: 'no-store',
      })
      const data = (await response.json().catch(() => null)) as {
        error?: { code?: string; message?: string }
      } | null
      if (!response.ok)
        throw new ApiError(
          data?.error?.code || 'server_error',
          data?.error?.message || '服务暂时不可用，请稍后重试。',
          response.status,
        )
      if (response.status === 204) return undefined as T
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
}

export function avatarURL(value: string): string {
  if (!/^\/api\/v1\/avatars\/[a-f0-9]{64}$/.test(value)) return ''
  return `${(import.meta.env.VITE_API_ORIGIN || '').replace(/\/+$/, '')}${value}`
}
