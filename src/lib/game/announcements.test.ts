import { describe, expect, it } from 'vitest'
import { roomFixture } from '../../test/room'
import { unoDeclarationNotice } from './announcements'

describe('公开 UNO 声明提示', () => {
  it.each(['Bot1', 'Bob'])(
    '轮询跳过 UNO 窗口时仍提示 %s 的真实声明',
    (name) => {
      const previous = roomFixture().state
      const current = structuredClone(previous)
      current.version = 4
      Object.assign(current.players[1], {
        name,
        hand_count: 1,
        uno_declared: 2,
      })
      expect(unoDeclarationNotice(previous, current)).toBe(`${name}：UNO!`)
    },
  )

  it('自己的声明仍显示精简 UNO!，重复轮询或重试不会重复提示', () => {
    const previous = roomFixture().state
    const current = structuredClone(previous)
    current.version = 3
    Object.assign(current.players[0], { uno_declared: 2, hand_count: 1 })
    expect(unoDeclarationNotice(previous, current)).toBe('UNO!')
    const later = structuredClone(current)
    later.version = 6
    expect(unoDeclarationNotice(current, later)).toBe('')
    expect(unoDeclarationNotice(later, current)).toBe('')
  })

  it('首次进入和恢复房间不会重放历史声明', () => {
    const current = roomFixture().state
    Object.assign(current.players[1], { uno_declared: 2 })
    current.version = 3
    expect(unoDeclarationNotice(undefined, current)).toBe('')
  })

  it('仅剩一张或 UNO 窗口消失不能冒充已喊 UNO', () => {
    const previous = roomFixture().state
    previous.version = 2
    previous.players[1].uno = { id: 2, deadline: '2026-10-25T00:00:02Z' }
    const current = structuredClone(previous)
    current.version = 4
    current.players[1].hand_count = 1
    delete current.players[1].uno
    expect(unoDeclarationNotice(previous, current)).toBe('')
  })

  it('同一轮询内多名玩家声明时合并显示，保留每个玩家的名称', () => {
    const previous = roomFixture().state
    const current = structuredClone(previous)
    current.version = 5
    Object.assign(current.players[0], { uno_declared: 2 })
    Object.assign(current.players[1], { uno_declared: 4 })
    expect(unoDeclarationNotice(previous, current)).toBe('你、Bob：UNO!')
  })
})

it('UNO 罚摸单独提示，不把罚摸与普通摸牌混为一谈', async () => {
  const { unoPenaltyNotice } = await import('./announcements')
  const previous = roomFixture().state,
    current = structuredClone(previous)
  current.version = 4
  Object.assign(current.players[0], { uno_penalized: 2, hand_count: 3 })
  expect(unoPenaltyNotice(previous, current)).toBe(
    '漏喊 UNO，罚摸一张；罚摸不占普通摸牌机会。',
  )
  expect(unoPenaltyNotice(current, { ...current, version: 5 })).toBe('')
  expect(unoPenaltyNotice(undefined, current)).toBe('')
})
