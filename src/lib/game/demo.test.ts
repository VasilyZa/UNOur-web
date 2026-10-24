import { afterEach, describe, expect, it, vi } from 'vitest'
import { DemoTransport } from './demo'
import type { Snapshot } from './types'

afterEach(() => vi.useRealTimers())

describe('可交互试玩', () => {
  it('出牌后减少手牌，机器人行动后回到本人且不泄露对手手牌', async () => {
    vi.useFakeTimers()
    const demo = new DemoTransport()
    let current!: Snapshot
    demo.subscribe((snapshot) => {
      current = snapshot
    })
    const me = () => current.room.state.players[0]
    const initial = me().hand_count
    await demo.act('play', { card_id: me().hand![0].id })
    expect(me().hand_count).toBe(initial - 1)
    await vi.advanceTimersByTimeAsync(3000)
    expect(current.room.state.turn).toBe(current.room.state.you)
    expect(current.room.state.players.slice(1).every((p) => !p.hand)).toBe(true)
    demo.dispose()
  })

  it('漏喊 UNO 只罚摸一张，同窗口重试不重复罚且不改变回合', async () => {
    vi.useFakeTimers()
    const demo = new DemoTransport('uno')
    let current!: Snapshot
    demo.subscribe((snapshot) => {
      current = snapshot
    })
    await demo.act('play', {
      card_id: current.room.state.players[0].hand![0].id,
    })
    const window = current.room.state.players[0].uno!
    await expect(
      demo.act('uno-penalty', { window_id: window.id }),
    ).rejects.toMatchObject({ code: 'uno_too_early' })
    await vi.advanceTimersByTimeAsync(2100)
    const turn = current.room.state.turn
    await demo.act('uno-penalty', { window_id: window.id })
    await demo.act('uno-penalty', { window_id: window.id })
    expect(current.room.state.players[0].hand_count).toBe(2)
    expect(current.room.state.turn).toBe(turn)
    demo.dispose()
  })

  it('及时声明后不再允许处罚，销毁后机器人不会继续更新界面', async () => {
    vi.useFakeTimers()
    const demo = new DemoTransport('uno')
    const listener = vi.fn()
    let current!: Snapshot
    demo.subscribe((snapshot) => {
      current = snapshot
      listener(snapshot)
    })
    await demo.act('play', {
      card_id: current.room.state.players[0].hand![0].id,
    })
    const window = current.room.state.players[0].uno!
    await demo.act('uno', { window_id: window.id })
    expect(current.room.state.players[0].uno).toBeUndefined()
    await vi.advanceTimersByTimeAsync(2200)
    await expect(
      demo.act('uno-penalty', { window_id: window.id }),
    ).rejects.toMatchObject({ code: 'uno_window_closed' })
    demo.dispose()
    listener.mockClear()
    await vi.advanceTimersByTimeAsync(5000)
    expect(listener).not.toHaveBeenCalled()
  })
})
