<script lang="ts">
  import type { Player } from '../game/types'
  let {
    player,
    active = false,
    index = 0,
  }: { player: Player; active?: boolean; index?: number } = $props()
  const palettes = [
    '#ddb8a1',
    '#acbabf',
    '#bdc79d',
    '#c1add0',
    '#d6bd83',
    '#90b5a9',
    '#cba69f',
    '#abc2d1',
    '#c6b7a6',
  ]
</script>

<div
  class:active
  class:eliminated={player.eliminated}
  class="opponent"
  aria-label={`${player.name}，${player.hand_count} 张手牌${active ? '，正在出牌' : ''}`}
>
  <div class="avatar-wrap">
    <div class="avatar" style:background={palettes[index % palettes.length]}>
      <svg viewBox="0 0 56 56" fill="none" aria-hidden="true">
        <path
          d={index % 2
            ? 'M8 56V32C8 8 47 9 48 32v24'
            : 'M9 56V31C9 8 45 6 47 30v26'}
          fill="#2b3530"
          opacity=".9"
        />
        <ellipse
          cx="28"
          cy="30"
          rx="13"
          ry="16"
          fill={index % 3 === 0 ? '#f3d8bb' : '#e9c6a5'}
        />
        <path
          d={index % 2
            ? 'M14 28c-1-22 27-23 28 0-9-2-15-8-16-11-2 7-6 9-12 11'
            : 'M14 25c2-20 29-20 28 4-7-5-11-8-15-13-3 5-7 7-13 9'}
          fill="#2b3530"
        />
        <path
          d="M22 30v2m12-2v2m-10 7c2 2 6 2 8 0"
          stroke="#57473d"
          stroke-width="1.7"
          stroke-linecap="round"
        />
        <path
          d="M8 56c2-15 37-17 41 0"
          fill={index % 2 ? '#e1dfd3' : '#778e78'}
        />
      </svg>
    </div>
    <span class="card-count"
      >{player.hand_count}<span class="sr-only"> 张</span></span
    >
  </div>
  <span class="player-name">{player.name}</span>
  <span class="player-caption"
    >{player.eliminated
      ? '已淘汰'
      : active
        ? '正在出牌'
        : player.hand_count === 1
          ? 'UNO!'
          : '等待中'}</span
  >
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
  .active .avatar-wrap {
    border-color: var(--accent);
  }
  .avatar {
    width: 48px;
    height: 48px;
    overflow: hidden;
    border-radius: 50%;
  }
  .avatar svg {
    width: 100%;
    height: 100%;
  }
  .card-count {
    position: absolute;
    right: -4px;
    bottom: 0;
    min-width: 24px;
    height: 23px;
    display: grid;
    place-items: center;
    background: #f0e9d9;
    border: 3px solid var(--surface);
    color: #343e35;
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
    .avatar {
      width: 32px;
      height: 32px;
    }
    .player-name {
      font-size: 10px;
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
</style>
