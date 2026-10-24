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
