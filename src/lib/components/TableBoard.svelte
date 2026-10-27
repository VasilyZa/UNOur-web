<script lang="ts">
  import CardFace from './CardFace.svelte'
  import PlayerBadge from './PlayerBadge.svelte'
  import Icon from './Icon.svelte'
  import { changeFeedback, resultEntrance } from '../motion/feedback'
  import { botDifficultyNames, colorNames, type Room } from '../game/types'
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
  let bots = $derived(room.bots ?? {})
  let botCount = $derived(Object.keys(bots).length)
  let botDifficulty = $derived(
    botCount ? botDifficultyNames[Object.values(bots)[0].difficulty] : '',
  )
  let botThinking = $derived(
    state.phase === 'playing' &&
      !!state.turn &&
      state.turn !== state.you &&
      !!bots[state.turn],
  )
  let myTurn = $derived(state.turn === state.you && state.phase === 'playing')
  let whisperVisible = $derived(
    state.phase === 'lobby' || !!me?.uno || state.pending_draw > 0,
  )
</script>

<section class="table-board" aria-label="牌桌">
  <div class="opponents-frame">
    <!-- Keyboard arrows scroll this native overflow region. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="opponents-viewport"
      class:many={opponents.length > 4}
      role="region"
      tabindex="0"
      aria-label="其他玩家，可左右滑动或使用方向键浏览"
    >
      <div class="opponents" class:many={opponents.length > 4}>
        {#each opponents as player (player.id)}<div
            class="opponent-slot"
            data-motion-player={player.id}
          >
            <PlayerBadge
              {player}
              {reduced}
              bot={bots[player.id]}
              avatarURL={room.profiles?.[player.id]?.avatar_url}
              active={state.turn === player.id}
            />
          </div>{/each}
        {#if !opponents.length}<div class="waiting-friend">
            <Icon name="users" size={24} /><span>等待其他玩家加入</span>
          </div>{/if}
      </div>
    </div>
  </div>
  {#if botCount}
    <div class="bot-match-line" aria-live="polite">
      <span>电脑对手 · {botDifficulty} · {botCount} 台电脑</span>
      {#if botThinking}<span class="bot-thinking"><i></i>电脑正在思考…</span
        >{/if}
    </div>
  {/if}
  <div class="arena" class:calling={!!me?.uno}>
    <div class="felt-ring" aria-hidden="true"></div>
    <div class="table-meta">
      <span
        class="current-color"
        use:changeFeedback={{ value: state.active_color ?? '', reduced }}
        ><i class={`color-dot ${state.active_color || 'red'}`}
        ></i>{state.phase === 'lobby'
          ? '准备发牌'
          : `当前${colorNames[state.active_color || 'red']}`}</span
      >
      <span
        class="direction"
        aria-label={state.direction === 1 ? '顺时针出牌' : '逆时针出牌'}
        ><span
          class="direction-glyph"
          use:changeFeedback={{
            value: state.direction,
            reduced,
            kind: 'direction',
          }}
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
          ></span
        >{state.direction === 1 ? '顺时针' : '逆时针'}</span
      >
    </div>
    {#if state.phase === 'finished'}
      <div class="finish-state" use:resultEntrance={reduced}>
        <span class="finish-icon"><Icon name="trophy" size={31} /></span><span
          class="eyebrow">本局结果</span
        >
        <h2>
          {state.winner === state.you
            ? '你获胜'
            : state.winner
              ? `${state.players.find((p) => p.id === state.winner)?.name || '玩家'}获胜`
              : '本局结束'}
        </h2>
      </div>
    {:else}
      <div class="piles" class:lobby={state.phase === 'lobby'}>
        <div class="pile-column">
          <div class="deck-wrap" data-motion-deck>
            <div class="deck-layer one" aria-hidden="true"></div>
            <div class="deck-layer two" aria-hidden="true"></div>
            {#if room.role === 'spectator'}
              <div class="deck-card spectator-deck" aria-hidden="true">
                <CardFace back />
              </div>
            {:else}
              <button
                class="deck-card"
                aria-label={state.pending_draw
                  ? `承受 ${state.pending_draw} 张罚牌`
                  : '摸一张牌'}
                disabled={!myTurn ||
                  busy ||
                  !state.legal_actions?.some(
                    (action) => action.action === 'draw',
                  )}
                onclick={ondraw}
                ><CardFace back /><span class="deck-plus"
                  ><Icon name="plus" size={15} /></span
                ></button
              >
            {/if}
          </div>
          <span class="pile-label"
            >牌堆 <span>{state.draw_pile_count}</span></span
          >
        </div>
        <div class="pile-column">
          <div class="discard-wrap" data-motion-discard>
            <div class="discard-shadow" aria-hidden="true"></div>
            {#key state.top_card?.id}<div class="discard-card">
                <div class="discard-inner">
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
          ><span class="uno-word">UNO!</span><span>剩余一张手牌</span><span
            class="uno-meter"
            aria-hidden="true"
            ><i
              style:transform={`scaleX(${Math.max(0, Math.min(1, remaining / 2000))})`}
            ></i></span
          ></button
        >
      {/if}
      <p
        class="table-whisper"
        class:quiet={!whisperVisible}
        aria-hidden={!whisperVisible}
      >
        {state.phase === 'lobby'
          ? botCount
            ? '人机对局准备中'
            : '复制房间号以邀请玩家'
          : me?.uno
            ? '点中央按钮 · 或按空格键'
            : state.pending_draw
              ? `桌上有 ${state.pending_draw} 张罚牌待处理`
              : ''}
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
  .opponents-frame {
    min-width: 0;
    flex: 0 0 auto;
  }
  .opponents-viewport {
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scrollbar-width: thin;
    scrollbar-color: var(--line-strong) transparent;
    -webkit-overflow-scrolling: touch;
    outline-offset: -2px;
  }
  .opponents-viewport:focus-visible {
    outline: 2px solid var(--focus);
    border-radius: 8px;
  }
  .opponents {
    display: flex;
    justify-content: space-evenly;
    gap: 16px;
    padding: 5px 24px 4px;
    width: 100%;
  }
  .opponents.many {
    width: max-content;
    min-width: 100%;
    justify-content: flex-start;
    gap: 12px;
  }
  .opponent-slot {
    flex: 0 0 80px;
    min-width: 0;
    scroll-snap-align: center;
  }
  .many.opponents-viewport {
    scroll-snap-type: inline proximity;
  }
  .bot-match-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 3px 26px 0;
    color: var(--muted);
    font-size: 9px;
  }
  .bot-thinking {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--accent);
    white-space: nowrap;
  }
  .bot-thinking i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
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
    border: 1px solid var(--table-line);
    border-radius: 50%;
    background: radial-gradient(
      ellipse at 50% 50%,
      var(--table-glow),
      transparent 70%
    );
    z-index: -1;
  }
  .felt-ring::after {
    content: '';
    position: absolute;
    inset: 10px;
    border: 1px dashed var(--table-line);
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
    color: var(--muted);
  }
  .current-color {
    color: var(--muted);
  }
  .direction {
    font-size: 9px;
  }
  .direction-glyph {
    display: inline-flex;
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
    background: #d9dde4;
    border: 3px solid #f1f2f5;
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
    box-shadow: 0 8px 20px var(--shadow);
    transition: transform 120ms var(--ease-out);
  }
  .spectator-deck {
    cursor: default;
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
    background: var(--surface-raised);
    color: var(--text);
    border-radius: 50%;
    border: 3px solid var(--surface);
  }
  .discard-shadow {
    position: absolute;
    inset: 0;
    background: #e0e3e8;
    border-radius: 11px;
    transform: rotate(-8deg);
    opacity: 0.35;
  }
  .discard-card {
    position: absolute;
    inset: 0;
    transform: rotate(9deg);
    filter: drop-shadow(2px 9px 8px var(--shadow-strong));
  }
  .discard-inner {
    width: 100%;
    height: 100%;
  }
  .pile-label {
    font-size: 10px;
    color: var(--muted);
    display: flex;
    gap: 5px;
    align-items: center;
  }
  .pile-label > span {
    font-size: 9px;
    padding: 2px 4px;
    background: var(--hover);
    border-radius: 4px;
  }
  .table-whisper {
    /* Keep the piles fixed when UNO/penalty hints appear or are dismissed. */
    min-height: 1.5em;
    line-height: 1.5;
    text-align: center;
    color: var(--muted);
    font-size: 10px;
    letter-spacing: 0.6px;
    margin: 4px 0 19px;
  }
  .table-whisper.quiet {
    visibility: hidden;
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
    border: 1px solid var(--accent-line);
    border-radius: 20px;
    background: var(--accent);
    color: var(--on-accent);
    cursor: pointer;
    box-shadow: 0 10px 40px var(--shadow-strong);
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
    background: var(--meter-track);
  }
  .uno-meter i {
    height: 100%;
    display: block;
    background: var(--on-accent);
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
    color: var(--warning);
    border: 1px solid var(--warning-line);
    background: var(--warning-soft);
    border-radius: 50%;
    margin-bottom: 10px;
  }
  .finish-state h2 {
    font-size: 23px;
    margin: 0;
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
    .opponents.many {
      gap: 8px;
      padding-bottom: 4px;
    }
    .opponent-slot {
      flex-basis: 73px;
    }
    .bot-match-line {
      display: none;
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
    .opponents.many {
      padding-bottom: 0;
    }
    .arena {
      min-height: 130px;
      margin-top: 4px;
      padding-top: 5px;
    }
    .deck-wrap,
    .discard-wrap {
      width: 58px;
      height: 84px;
    }
    .piles {
      padding: 8px 0 2px;
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
      min-height: 120px;
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
