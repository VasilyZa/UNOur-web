import { describe, expect, it } from 'vitest'
import { roomFixture } from '../../test/room'
import {
  allowedWildColors,
  buildRuleSpecs,
  defaultRuleOptions,
  matchingHint,
  readRuleOptions,
} from './rules'

describe('可选房间规则', () => {
  it('拒绝同时关闭同色和同数字，保留单一匹配方式', () => {
    const options = {
      ...defaultRuleOptions(),
      sameColor: false,
      sameValue: false,
    }
    expect(() => buildRuleSpecs(options)).toThrow(/至少/)
    options.sameValue = true
    expect(buildRuleSpecs(options)[0]).toEqual({
      name: 'matching',
      options: { same_color: false, same_value: true },
    })
  })
  it('完整传递可选配置，并保留普通摸牌后出牌', () => {
    const options = {
      ...defaultRuleOptions(),
      stacking: true,
      mixedStacking: true,
      skipDraw: true,
      reverseStacking: true,
      keepColor: true,
      doubleChallengePenalty: true,
      differentColorStacking: true,
      playAnyAfterDraw: true,
    }
    expect(buildRuleSpecs(options)).toEqual([
      { name: 'matching', options: { same_color: true, same_value: true } },
      { name: 'actions', options: { skip_draw: true, keep_color: true } },
      {
        name: 'draw',
        options: { play_drawn_card: true, play_any_after_draw: true },
      },
      { name: 'challenge', options: { failure_multiplier: 200 } },
      {
        name: 'stacking',
        options: { mixed: true, different_colors: true, reverse: true },
      },
    ])
    expect(readRuleOptions(buildRuleSpecs(options))).toEqual(options)
  })
  it('关闭总开关后不残留叠加或质疑规则，重新开启保留偏好', () => {
    const options = {
      ...defaultRuleOptions(),
      stacking: false,
      challenge: false,
      mixedStacking: true,
      reverseStacking: true,
      differentColorStacking: true,
      doubleChallengePenalty: true,
    }
    expect(buildRuleSpecs(options).map((rule) => rule.name)).toEqual([
      'matching',
      'actions',
      'draw',
    ])
    options.challenge = true
    options.doubleChallengePenalty = false
    expect(
      buildRuleSpecs(options).find((rule) => rule.name === 'challenge')?.options
        ?.failure_multiplier,
    ).toBe(150)
  })
  it('以服务端返回的规则读取默认值和缺省规则', () => {
    const options = readRuleOptions([
      { name: 'matching' },
      { name: 'actions' },
      { name: 'draw' },
      { name: 'challenge' },
    ])
    expect(options).toEqual(defaultRuleOptions())
    expect(readRuleOptions([{ name: 'actions' }])).toMatchObject({
      sameColor: false,
      sameValue: false,
      challenge: false,
      stacking: false,
    })
  })
  it('关闭保留颜色时只允许选择其他三色', () => {
    const room = roomFixture()
    expect(allowedWildColors(room)).toEqual(['yellow', 'green', 'blue'])
    room.rules = [{ name: 'actions', options: { keep_color: true } }]
    expect(allowedWildColors(room)).toEqual(['red', 'yellow', 'green', 'blue'])
  })
  it('出牌指引只说明已启用的匹配方式', () => {
    expect(
      matchingHint(
        [
          {
            name: 'matching',
            options: { same_color: false, same_value: true },
          },
        ],
        'red',
      ),
    ).toBe('出相同数字或动作牌，或万能牌')
    expect(
      matchingHint(
        [
          {
            name: 'matching',
            options: { same_color: true, same_value: false },
          },
        ],
        'blue',
      ),
    ).toBe('出蓝色牌，或万能牌')
  })
})
