import { describe, expect, it, vi, afterEach } from 'vitest'
import { ApiClient, ApiError } from './api'

afterEach(() => vi.unstubAllGlobals())

describe('API 安全请求', () => {
  it('发送会话、版本与 JSON，并转义房间路径', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ room: { id: 'a/b' } })))
    vi.stubGlobal('fetch', fetcher)
    await new ApiClient('').action(
      { roomId: 'a/b', token: 'private-token', playerId: 'me' },
      'play',
      { card_id: 3, expected_version: 9 },
    )
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('/api/v1/rooms/a%2Fb/play')
    expect(init.headers.Authorization).toBe('Bearer private-token')
    expect(JSON.parse(init.body)).toEqual({ card_id: 3, expected_version: 9 })
  })

  it('普通命令网络失败只发送一次，避免重复摸牌', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('network down'))
    vi.stubGlobal('fetch', fetcher)
    await expect(
      new ApiClient('').action(
        { roomId: 'r', token: 't', playerId: 'me' },
        'draw',
      ),
    ).rejects.toBeInstanceOf(ApiError)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('保留服务器错误码，供 UNO 提前上报与冲突处理使用', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: 'uno_too_early', message: 'early' },
          }),
          { status: 409 },
        ),
      ),
    )
    await expect(
      new ApiClient('').action(
        { roomId: 'r', token: 't', playerId: 'me' },
        'uno-penalty',
        { window_id: 2 },
      ),
    ).rejects.toMatchObject({ code: 'uno_too_early', status: 409 })
  })
})
