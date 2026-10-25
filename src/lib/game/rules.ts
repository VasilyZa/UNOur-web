import type { Color, Kind, PlayColor, Room, RuleSpec } from './types'
import { colorNames } from './types'

export interface RoomRuleOptions {
  sameColor: boolean
  sameValue: boolean
  stacking: boolean
  mixedStacking: boolean
  skipDraw: boolean
  reverseStacking: boolean
  keepColor: boolean
  challenge: boolean
  doubleChallengePenalty: boolean
  differentColorStacking: boolean
  playAnyAfterDraw: boolean
}

export function defaultRuleOptions(): RoomRuleOptions {
  return {
    sameColor: true,
    sameValue: true,
    stacking: false,
    mixedStacking: false,
    skipDraw: false,
    reverseStacking: false,
    keepColor: false,
    challenge: true,
    doubleChallengePenalty: false,
    differentColorStacking: false,
    playAnyAfterDraw: false,
  }
}

export function buildRuleSpecs(options: RoomRuleOptions): RuleSpec[] {
  if (!options.sameColor && !options.sameValue)
    throw new Error('同色与同数字至少启用一项。')
  const specs: RuleSpec[] = [
    {
      name: 'matching',
      options: { same_color: options.sameColor, same_value: options.sameValue },
    },
    {
      name: 'actions',
      options: { skip_draw: options.skipDraw, keep_color: options.keepColor },
    },
    {
      name: 'draw',
      options: {
        play_drawn_card: true,
        play_any_after_draw: options.playAnyAfterDraw,
      },
    },
  ]
  if (options.challenge)
    specs.push({
      name: 'challenge',
      options: {
        failure_multiplier: options.doubleChallengePenalty ? 200 : 150,
      },
    })
  if (options.stacking)
    specs.push({
      name: 'stacking',
      options: {
        mixed: options.mixedStacking,
        different_colors: options.differentColorStacking,
        reverse: options.reverseStacking,
      },
    })
  return specs
}

/** Read the actual room policy, including the registry's per-rule defaults. */
export function readRuleOptions(specs: RuleSpec[]): RoomRuleOptions {
  const matching = specs.find((rule) => rule.name === 'matching')
  const actions = specs.find((rule) => rule.name === 'actions')
  const stacking = specs.find((rule) => rule.name === 'stacking')
  const challenge = specs.find((rule) => rule.name === 'challenge')
  const draw = specs.find((rule) => rule.name === 'draw')
  return {
    sameColor: !!matching && matching.options?.same_color !== false,
    sameValue: !!matching && matching.options?.same_value !== false,
    stacking: !!stacking,
    mixedStacking: stacking?.options?.mixed === true,
    skipDraw: actions?.options?.skip_draw === true,
    reverseStacking: stacking?.options?.reverse === true,
    keepColor: actions?.options?.keep_color === true,
    challenge: !!challenge,
    doubleChallengePenalty: challenge?.options?.failure_multiplier === 200,
    differentColorStacking: stacking?.options?.different_colors === true,
    playAnyAfterDraw: draw?.options?.play_any_after_draw === true,
  }
}

export function allowedWildColors(room: Room): PlayColor[] {
  const colors: PlayColor[] = ['red', 'yellow', 'green', 'blue']
  const keep =
    room.rules.find((rule) => rule.name === 'actions')?.options?.keep_color ===
    true
  return keep
    ? colors
    : colors.filter((color) => color !== room.state.active_color)
}

export function matchingHint(
  specs: RuleSpec[],
  activeColor?: Color,
  topKind?: Kind,
): string {
  const options = readRuleOptions(specs)
  if ((topKind === 'wild' || topKind === 'wild_draw_four') && activeColor)
    return `出${colorNames[activeColor]}牌，或万能牌`
  const choices = []
  if (options.sameColor && activeColor)
    choices.push(`${colorNames[activeColor]}牌`)
  if (options.sameValue) choices.push('相同数字或动作牌')
  return choices.length ? `出${choices.join('、')}，或万能牌` : '按本局规则出牌'
}
