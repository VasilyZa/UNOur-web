import { describe, expect, it, vi, afterEach } from 'vitest'
import { ApiClient, ApiError } from './api'

afterEach(() => vi.unstubAllGlobals())

describe('API 安全请求', () => {
  it('通过账户身份创建已开局的人机牌局', async () => {
    const join = {
      player_id: 'human',
      token: 'private-token',
      room: { id: 'solo-room' },
    }
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(join)))
    vi.stubGlobal('fetch', fetcher)
    const rules = [{ name: 'matching' }, { name: 'actions' }]

    await expect(
      new ApiClient('').solo('account', 3, 'hard', rules),
    ).resolves.toEqual(join)

    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('/api/v1/solo')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.headers['X-Account-ID']).toBe('account')
    expect(JSON.parse(init.body)).toEqual({
      bot_count: 3,
      difficulty: 'hard',
      rules,
    })
  })

  it('发送会话、版本与 JSON，并转义房间路径', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ room: { id: 'a/b' } })))
    vi.stubGlobal('fetch', fetcher)
    await new ApiClient('').action(
      {
        roomId: 'a/b',
        token: 'private-token',
        playerId: 'me',
        accountId: 'account',
      },
      'play',
      { card_id: 3, expected_version: 9 },
    )
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('/api/v1/rooms/a%2Fb/play')
    expect(init.headers.Authorization).toBe('Bearer private-token')
    expect(init.headers['X-Account-ID']).toBe('account')
    expect(JSON.parse(init.body)).toEqual({ card_id: 3, expected_version: 9 })
  })

  it('普通命令网络失败只发送一次，避免重复摸牌', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('network down'))
    vi.stubGlobal('fetch', fetcher)
    await expect(
      new ApiClient('').action(
        { roomId: 'r', token: 't', playerId: 'me', accountId: 'account' },
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
        { roomId: 'r', token: 't', playerId: 'me', accountId: 'account' },
        'uno-penalty',
        { window_id: 2 },
      ),
    ).rejects.toMatchObject({ code: 'uno_too_early', status: 409 })
  })
})
