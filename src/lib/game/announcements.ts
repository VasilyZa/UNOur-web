import type { GameState } from './types'

export function unoDeclarationNotice(
  previous: GameState | undefined,
  current: GameState,
): string {
  if (!previous || current.version <= previous.version) return ''
  const known = new Map(previous.players.map((player) => [player.id, player]))
  const declared = current.players.filter((player) => {
    const before = known.get(player.id)
    return before && (player.uno_declared ?? 0) > (before.uno_declared ?? 0)
  })
  if (!declared.length) return ''
  if (declared.length === 1 && declared[0].id === current.you) return 'UNO!'
  const names = declared.map((player) =>
    player.id === current.you ? '你' : player.name,
  )
  return `${names.join('、')}：UNO!`
}

// The persisted window number distinguishes an automatic UNO penalty from a
// normal draw, including when polling skipped the short-lived UNO window.
export function unoPenaltyNotice(
  previous: GameState | undefined,
  current: GameState,
): string {
  if (!previous || current.version <= previous.version) return ''
  const before = previous.players.find((player) => player.id === current.you)
  const player = current.players.find((player) => player.id === current.you)
  return before &&
    player &&
    (player.uno_penalized ?? 0) > (before.uno_penalized ?? 0)
    ? '漏喊 UNO，罚摸一张；罚摸不占普通摸牌机会。'
    : ''
}
