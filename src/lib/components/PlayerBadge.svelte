<script lang="ts">
  import Avatar from './Avatar.svelte'
  import { changeFeedback } from '../motion/feedback'
  import { botDifficultyNames, type BotSeat, type Player } from '../game/types'
  let {
    player,
    bot,
    active = false,
    avatarURL = '',
    reduced = false,
  }: {
    player: Player
    bot?: BotSeat
    active?: boolean
    avatarURL?: string
    reduced?: boolean
  } = $props()
  let status = $derived(
    player.eliminated
      ? '已淘汰'
      : active && bot
        ? '思考中…'
        : active
          ? '正在出牌'
          : player.hand_count === 1
            ? 'UNO!'
            : '等待中',
  )
</script>

<div
  class:active
  class:eliminated={player.eliminated}
  class:gentle={reduced}
  class="opponent"
  aria-label={`${player.name}${bot ? `，电脑，${botDifficultyNames[bot.difficulty]}难度` : ''}，${player.hand_count} 张手牌${active ? `，${status}` : ''}`}
>
  <div class="avatar-wrap">
    <div class="avatar"><Avatar src={avatarURL} size="100%" /></div>
    <span
      class="card-count"
      use:changeFeedback={{ value: player.hand_count, reduced, kind: 'count' }}
      >{player.hand_count}<span class="sr-only"> 张</span></span
    >
  </div>
  <span class="player-name">{player.name}</span>
  {#if bot}<span class="player-kind"
      >电脑 · {botDifficultyNames[bot.difficulty]}</span
    >{/if}
  <span class="player-caption" class:computer={!!bot}>{status}</span>
</div>

<style>
  .opponent {
    display: grid;
    justify-items: center;
    gap: 4px;
    min-width: 0;
  }
  .avatar-wrap {
    position: relative;
    padding: 4px;
    border: 1px solid transparent;
    border-radius: 50%;
  }
  .avatar-wrap::after {
    content: '';
    position: absolute;
    inset: -1px;
    border: 1px solid var(--accent);
    border-radius: inherit;
    opacity: 0;
    transform: scale(0.97);
    pointer-events: none;
    transition:
      transform 160ms var(--ease-out),
      opacity 160ms var(--ease-out);
  }
  .active .avatar-wrap {
    border-color: transparent;
  }
  .active .avatar-wrap::after {
    opacity: 1;
    transform: scale(1);
  }
  .avatar {
    width: 48px;
    height: 48px;
    overflow: hidden;
    border-radius: 50%;
  }
  .card-count {
    position: absolute;
    right: -4px;
    bottom: 0;
    min-width: 24px;
    height: 23px;
    display: grid;
    place-items: center;
    background: var(--accent);
    border: 3px solid var(--surface);
    color: var(--on-accent);
    border-radius: 8px;
    font: 800 11px var(--font);
    padding: 0 3px;
  }
  .player-name {
    max-width: 100%;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .player-caption {
    font-size: 10px;
    color: var(--muted);
    min-height: 14px;
  }
  .player-kind {
    max-width: 100%;
    color: var(--muted);
    font-size: 9px;
    line-height: 1.2;
    white-space: nowrap;
  }
  .opponent.active .player-kind {
    color: var(--accent);
  }
  .active .player-caption {
    color: var(--accent);
  }
  .eliminated {
    opacity: 0.45;
  }
  @media (min-width: 700px) {
    .avatar {
      width: 54px;
      height: 54px;
    }
    .player-name {
      font-size: 13px;
    }
  }
  @media (max-width: 699px) {
    .player-caption {
      display: none;
    }
    .player-caption.computer {
      display: none;
    }
    .player-kind {
      font-size: 8px;
    }
    .active .player-name {
      color: var(--accent);
    }
  }
  @media (max-height: 800px) and (max-width: 699px) {
    .avatar {
      width: 40px;
      height: 40px;
    }
    .player-caption {
      display: none;
    }
  }
  @media (max-height: 650px) and (max-width: 699px) {
    .opponent {
      gap: 2px;
    }
    .avatar {
      width: 32px;
      height: 32px;
    }
    .player-name {
      font-size: 10px;
    }
    .player-kind {
      font-size: 7px;
    }
  }
  @media (min-width: 700px) and (max-height: 1100px) {
    .avatar {
      width: 44px;
      height: 44px;
    }
    .player-caption {
      display: none;
    }
    .active .player-name {
      color: var(--accent);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .avatar-wrap::after {
      transform: none;
      transition: opacity 120ms var(--ease-out);
    }
  }
  :global(.gentle) .avatar-wrap::after {
    transform: none;
    transition: opacity 120ms var(--ease-out);
  }
</style>
