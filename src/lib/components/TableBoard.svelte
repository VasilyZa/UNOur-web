<script lang="ts">
  import CardFace from './CardFace.svelte'
  import PlayerBadge from './PlayerBadge.svelte'
  import Icon from './Icon.svelte'
  import { colorNames, type Room } from '../game/types'
  let {
    room,
    busy,
    ondraw,
    onuno,
    remaining = 0,
    reduced = false,
  }: {
    room: Room
    busy: boolean
    ondraw: () => void
    onuno: () => void
    remaining?: number
    reduced?: boolean
  } = $props()
  let state = $derived(room.state)
  let me = $derived(state.players.find((p) => p.id === state.you))
  let opponents = $derived(state.players.filter((p) => p.id !== state.you))
  let myTurn = $derived(state.turn === state.you && state.phase === 'playing')

  function arrive(node: HTMLElement) {
    const gentle =
      reduced || matchMedia('(prefers-reduced-motion: reduce)').matches
    const animation = node.animate(
      [
        {
          opacity: 0.4,
          transform: gentle
            ? 'none'
            : 'translateY(16px) rotate(-6deg) scale(.97)',
        },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    )
    return {
      destroy() {
        animation.cancel()
      },
    }
  }
</script>

<section class="table-board" aria-label="牌桌">
  <div class="opponents" aria-label="其他玩家">
    {#each opponents as player, index (player.id)}<div class="opponent-slot">
        <PlayerBadge {player} {index} active={state.turn === player.id} />
      </div>{/each}
    {#if !opponents.length}<div class="waiting-friend">
        <Icon name="users" size={24} /><span>留个位置，等朋友来</span>
      </div>{/if}
  </div>
  <div class="arena" class:calling={!!me?.uno}>
    <div class="felt-ring" aria-hidden="true"></div>
    <div class="table-meta">
      <span class="current-color"
        ><i class={`color-dot ${state.active_color || 'red'}`}
        ></i>{state.phase === 'lobby'
          ? '准备发牌'
          : `当前${colorNames[state.active_color || 'red']}`}</span
      >
      <span
        class="direction"
        aria-label={state.direction === 1 ? '顺时针出牌' : '逆时针出牌'}
        ><svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
          style:transform={state.direction === 1 ? 'none' : 'scaleX(-1)'}
          ><path
            d="M3 11a9 9 0 0 1 16-5l2 3M21 3v6h-6M21 13a9 9 0 0 1-16 5l-2-3M3 21v-6h6"
          /></svg
        >{state.direction === 1 ? '顺时针' : '逆时针'}</span
      >
    </div>
    {#if state.phase === 'finished'}
      <div class="finish-state">
        <span class="finish-icon"><Icon name="trophy" size={31} /></span><span
          class="eyebrow">NICE GAME</span
        >
        <h2>
          {state.winner === state.you
            ? '漂亮，赢下这一局！'
            : `${state.players.find((p) => p.id === state.winner)?.name || '本局'}获胜`}
        </h2>
        <p>好牌值得分享，好朋友再来一局。</p>
      </div>
    {:else}
      <div class="piles" class:lobby={state.phase === 'lobby'}>
        <div class="pile-column">
          <div class="deck-wrap">
            <div class="deck-layer one" aria-hidden="true"></div>
            <div class="deck-layer two" aria-hidden="true"></div>
            <button
              class="deck-card"
              aria-label={state.pending_draw
                ? `承受 ${state.pending_draw} 张罚牌`
                : '摸一张牌'}
              disabled={!myTurn || busy || state.can_pass}
              onclick={ondraw}
              ><CardFace back /><span class="deck-plus"
                ><Icon name="plus" size={15} /></span
              ></button
            >
          </div>
          <span class="pile-label"
            >牌堆 <span>{state.draw_pile_count}</span></span
          >
        </div>
        <div class="pile-column">
          <div class="discard-wrap">
            <div class="discard-shadow" aria-hidden="true"></div>
            {#key state.top_card?.id}<div class="discard-card">
                <div class="discard-inner" use:arrive>
                  <CardFace card={state.top_card} back={!state.top_card} />
                </div>
              </div>{/key}
          </div>
          <span class="pile-label"
            >{state.phase === 'lobby' ? '等待开局' : '上一张牌'}</span
          >
        </div>
      </div>
      {#if me?.uno}
        <button class="uno-call" onclick={onuno} aria-label="喊 UNO，立即确认"
          ><span class="uno-word">UNO!</span><span>只剩一张，快喊出来</span
          ><span class="uno-meter" aria-hidden="true"
            ><i
              style:transform={`scaleX(${Math.max(0, Math.min(1, remaining / 2000))})`}
            ></i></span
          ></button
        >
      {/if}
      <p class="table-whisper">
        {state.phase === 'lobby'
          ? '复制房间号，邀请朋友一起坐下'
          : me?.uno
            ? '点中央按钮 · 或按空格键'
            : state.pending_draw
              ? `桌上有 ${state.pending_draw} 张罚牌待处理`
              : '好牌，好朋友，好时光。'}
      </p>
    {/if}
  </div>
</section>

<style>
  .table-board {
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .opponents {
    display: flex;
    justify-content: space-evenly;
    gap: 16px;
    padding: 5px 24px 4px;
    overflow-x: auto;
    flex: 0 0 auto;
    scrollbar-width: none;
  }
  .opponent-slot {
    flex: 0 0 80px;
    min-width: 0;
  }
  .waiting-friend {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--muted);
    height: 86px;
    font-size: 12px;
  }
  .arena {
    display: flex;
    flex-direction: column;
    position: relative;
    flex: 1;
    min-height: 265px;
    margin: 10px 24px 0;
    padding: 20px 28px 0;
    isolation: isolate;
  }
  .felt-ring {
    position: absolute;
    width: min(91%, 530px);
    height: 90%;
    min-height: 215px;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    border: 1px solid #7b99731c;
    border-radius: 50%;
    background: radial-gradient(ellipse at 50% 50%, #344d3833, #1b291900 70%);
    z-index: -1;
  }
  .felt-ring::after {
    content: '';
    position: absolute;
    inset: 10px;
    border: 1px dashed #7b997314;
    border-radius: inherit;
  }
  .table-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 410px;
    width: 100%;
    align-self: center;
    padding: 0 8px;
  }
  .current-color,
  .direction {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #a5b29f;
  }
  .current-color {
    color: #d0d6c8;
  }
  .direction {
    font-size: 9px;
  }
  .piles {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    gap: 52px;
    padding: 27px 0 17px;
  }
  .pile-column {
    display: grid;
    justify-items: center;
    gap: 19px;
  }
  .deck-wrap,
  .discard-wrap {
    width: 100px;
    height: 144px;
    position: relative;
  }
  .deck-layer {
    position: absolute;
    inset: 0;
    background: #d9ddcb;
    border: 3px solid #eae4d6;
    border-radius: 11px;
  }
  .deck-layer.one {
    transform: translate(-5px, 5px) rotate(-6deg);
    opacity: 0.45;
  }
  .deck-layer.two {
    transform: translate(-2px, 2px) rotate(-3deg);
    opacity: 0.7;
  }
  .deck-card {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    padding: 0;
    border-radius: 11px;
    background: transparent;
    cursor: pointer;
    box-shadow: 0 8px 20px #0003;
    transition: transform 120ms var(--ease-out);
  }
  .deck-card:active:not(:disabled) {
    transform: scale(0.97);
  }
  .deck-card:disabled {
    cursor: default;
  }
  .deck-plus {
    position: absolute;
    bottom: -8px;
    right: -8px;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    background: var(--cream);
    color: #3b4a3c;
    border-radius: 50%;
    border: 3px solid var(--surface);
  }
  .discard-shadow {
    position: absolute;
    inset: 0;
    background: #e2dfcc;
    border-radius: 11px;
    transform: rotate(-8deg);
    opacity: 0.35;
  }
  .discard-card {
    position: absolute;
    inset: 0;
    transform: rotate(9deg);
    filter: drop-shadow(2px 9px 8px #0004);
  }
  .discard-inner {
    width: 100%;
    height: 100%;
  }
  .pile-label {
    font-size: 10px;
    color: #9ba993;
    display: flex;
    gap: 5px;
    align-items: center;
  }
  .pile-label > span {
    font-size: 9px;
    padding: 2px 4px;
    background: #ffffff0a;
    border-radius: 4px;
  }
  .table-whisper {
    text-align: center;
    color: #84967e;
    font-size: 10px;
    letter-spacing: 0.6px;
    margin: 4px 0 19px;
  }
  .uno-call {
    position: absolute;
    z-index: 4;
    left: 50%;
    top: 48%;
    transform: translate(-50%, -50%);
    width: 222px;
    height: 111px;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    gap: 7px;
    border: 1px solid #ffb69a;
    border-radius: 20px;
    background: #ec8d70;
    color: #26392e;
    cursor: pointer;
    box-shadow: 0 10px 40px #0d1e13a6;
  }
  .uno-word {
    font-size: 37px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -2px;
    font-style: italic;
  }
  .uno-call > span:nth-child(2) {
    font-size: 11px;
    font-weight: 600;
  }
  .uno-meter {
    position: absolute;
    left: 22px;
    right: 22px;
    bottom: 11px;
    height: 3px;
    border-radius: 3px;
    overflow: hidden;
    background: #344b3429;
  }
  .uno-meter i {
    height: 100%;
    display: block;
    background: #2d4936;
    transform-origin: left;
  }
  .finish-state {
    display: flex;
    flex-direction: column;
    flex: 1;
    justify-content: center;
    align-items: center;
    padding: 30px 0;
    gap: 10px;
    text-align: center;
  }
  .finish-icon {
    width: 65px;
    height: 65px;
    display: grid;
    place-items: center;
    color: #e9bf59;
    border: 1px solid #e9bf5933;
    background: #e9bf590c;
    border-radius: 50%;
    margin-bottom: 10px;
  }
  .finish-state h2 {
    font-size: 23px;
    margin: 0;
  }
  .finish-state p {
    color: var(--muted);
    font-size: 11px;
  }
  .lobby {
    opacity: 0.35;
  }
  @media (min-width: 1000px) {
    .arena {
      margin-top: 12px;
    }
  }
  @media (max-width: 699px) {
    .opponents {
      padding: 0 17px;
      gap: 9px;
    }
    .opponent-slot {
      flex-basis: 73px;
    }
    .arena {
      min-height: 222px;
      margin: 8px 14px 0;
      padding: 12px 12px 0;
    }
    .deck-wrap,
    .discard-wrap {
      width: 86px;
      height: 124px;
    }
    .piles {
      gap: 43px;
      padding: 18px 0 14px;
    }
    .pile-column {
      gap: 16px;
    }
    .table-meta {
      max-width: 280px;
    }
    .table-whisper {
      margin-bottom: 11px;
      font-size: 9px;
    }
    .felt-ring {
      width: 98%;
    }
  }
  @media (max-height: 800px) and (max-width: 699px) {
    .arena {
      min-height: 194px;
      margin-top: 6px;
      padding-top: 8px;
    }
    .deck-wrap,
    .discard-wrap {
      width: 70px;
      height: 101px;
    }
    .piles {
      padding: 16px 0 10px;
      gap: 43px;
    }
    .pile-column {
      gap: 12px;
    }
    .table-whisper {
      margin: 2px 0 9px;
    }
    .felt-ring {
      min-height: 175px;
      top: 0;
    }
    .uno-call {
      width: 195px;
      height: 100px;
    }
  }
  @media (max-height: 650px) and (max-width: 699px) {
    .arena {
      min-height: 141px;
      margin-top: 4px;
      padding-top: 5px;
    }
    .deck-wrap,
    .discard-wrap {
      width: 58px;
      height: 84px;
    }
    .piles {
      padding: 12px 0 4px;
    }
    .pile-column {
      gap: 9px;
    }
    .pile-label {
      font-size: 8px;
    }
    .table-whisper {
      display: none;
    }
    .felt-ring {
      min-height: 140px;
    }
    .uno-call {
      width: 175px;
      height: 95px;
    }
    .table-meta {
      max-width: 235px;
    }
  }
  @media (min-width: 700px) and (max-height: 1100px) {
    .arena {
      min-height: 220px;
      padding-top: 12px;
    }
    .deck-wrap,
    .discard-wrap {
      width: 86px;
      height: 124px;
    }
    .piles {
      padding: 18px 0 12px;
      gap: 45px;
    }
    .pile-column {
      gap: 14px;
    }
    .table-whisper {
      margin-bottom: 12px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .deck-card {
      transition: none;
    }
    .deck-card:active:not(:disabled) {
      transform: none;
    }
  }
  :global(.gentle) .deck-card:active {
    transform: none;
  }
</style>
