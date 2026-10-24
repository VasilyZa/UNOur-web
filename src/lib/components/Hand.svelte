<script lang="ts">
  import { onMount } from 'svelte'
  import CardFace from './CardFace.svelte'
  import Icon from './Icon.svelte'
  import {
    cardName,
    suggestsPlayable,
    type Card,
    type Room,
  } from '../game/types'
  let {
    room,
    selected,
    onselect,
    sorted = false,
    onsort,
    busy = false,
    reduced = false,
  }: {
    room: Room
    selected: number | null
    onselect: (card: Card) => void
    sorted?: boolean
    onsort: () => void
    busy?: boolean
    reduced?: boolean
  } = $props()
  const order = { red: 0, yellow: 1, green: 2, blue: 3, wild: 4 }
  let hand = $derived(
    room.state.players.find((p) => p.id === room.state.you)?.hand || [],
  )
  let displayed = $derived(
    sorted
      ? [...hand].sort(
          (a, b) =>
            order[a.color] - order[b.color] ||
            (a.number ?? 10) - (b.number ?? 10),
        )
      : hand,
  )
  let myTurn = $derived(
    room.state.turn === room.state.you && room.state.phase === 'playing',
  )
  let mounted = false
  onMount(() => {
    mounted = true
  })
  function cardIn(node: HTMLElement, index: number) {
    const gentle =
      reduced || matchMedia('(prefers-reduced-motion: reduce)').matches
    const animation = node.animate(
      [
        { opacity: 0.25, transform: gentle ? 'none' : 'translateY(12px)' },
        { opacity: 1, transform: 'none' },
      ],
      {
        duration: 160,
        delay: mounted || gentle ? 0 : Math.min(index, 6) * 40,
        easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
    )
    return {
      destroy() {
        animation.cancel()
      },
    }
  }
</script>

<section class="hand-section" aria-label="你的手牌">
  <div class="hand-heading">
    <div>
      <span class="hand-title">我的手牌</span><span class="hand-total"
        >{hand.length} 张</span
      >
    </div>
    <button class="text-button sort" onclick={onsort} aria-pressed={sorted}
      ><Icon name="sort" size={15} />{sorted ? '原始顺序' : '整理手牌'}</button
    >
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (原生滚动区域需要键盘焦点以支持方向键浏览手牌。) -->
  <div
    class="hand-scroll"
    tabindex="0"
    role="region"
    aria-label="手牌列表，可左右滚动"
  >
    <div class="hand-track">
      {#each displayed as card, index (card.id)}
        {@const playable = suggestsPlayable(card, room)}
        {@const angle =
          displayed.length <= 8 ? (index - (displayed.length - 1) / 2) * 2 : 0}
        <div class="hand-slot">
          <button
            class="hand-card"
            class:selected={selected === card.id}
            class:unplayable={myTurn && !playable}
            style:transform={reduced
              ? 'none'
              : selected === card.id
                ? 'translateY(-15px) rotate(0deg)'
                : `translateY(${Math.abs(angle) * 0.55}px) rotate(${angle}deg)`}
            aria-label={cardName(card)}
            aria-pressed={selected === card.id}
            disabled={busy || !myTurn}
            onclick={() => onselect(card)}
          >
            <div class="card-art" use:cardIn={index}><CardFace {card} /></div>
            {#if selected === card.id}<span class="selected-mark"
                ><Icon name="check" size={13} /></span
              >{/if}
          </button>
        </div>
      {/each}
      {#if !displayed.length}<p class="empty-hand">
          {room.state.phase === 'lobby'
            ? '等朋友到齐，就可以发牌了'
            : '手牌出完啦'}
        </p>{/if}
    </div>
  </div>
  <p class="hand-hint">
    {displayed.length > 7
      ? '左右滑动浏览手牌 · 点选后确认出牌'
      : selected !== null
        ? '选好了？确认出牌，或点另一张换牌'
        : '点选一张手牌，再确认出牌'}
  </p>
</section>

<style>
  .hand-section {
    min-width: 0;
    padding-top: 17px;
    border-top: 1px solid var(--line);
    container-type: inline-size;
  }
  .hand-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 24px;
  }
  .hand-heading > div {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .hand-title {
    font-size: 13px;
    font-weight: 600;
  }
  .hand-total {
    color: var(--muted);
    font-size: 11px;
  }
  .sort {
    gap: 6px;
    min-height: 32px;
    color: var(--muted);
    font-size: 11px;
  }
  .hand-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    padding: 25px 24px 10px;
    scrollbar-width: thin;
    scrollbar-color: #49584b transparent;
  }
  .hand-track {
    --card-width: 96px;
    --step: 58px;
    display: flex;
    width: max-content;
    min-width: 0;
    margin: 0 auto;
    padding: 0 4px;
  }
  .hand-slot {
    width: var(--step);
    flex: 0 0 var(--step);
    position: relative;
  }
  .hand-slot:last-child {
    width: var(--card-width);
    flex-basis: var(--card-width);
  }
  .hand-slot:focus-within,
  .hand-slot:has(.selected) {
    z-index: 2;
  }
  .hand-card {
    width: var(--card-width);
    aspect-ratio: 100 / 144;
    display: block;
    border: 0;
    padding: 0;
    border-radius: 11px;
    background: transparent;
    box-shadow: -3px 3px 12px #0004;
    cursor: pointer;
    transform-origin: center 120%;
    transition:
      transform 160ms var(--ease-out),
      opacity 120ms ease;
  }
  .hand-card.unplayable {
    filter: saturate(0.7) brightness(0.76);
  }
  .hand-card.selected {
    box-shadow:
      0 0 0 2px var(--surface),
      0 0 0 4px var(--accent),
      0 8px 20px #0004;
    opacity: 1;
  }
  .hand-card:disabled {
    cursor: default;
  }
  .card-art {
    width: 100%;
    height: 100%;
  }
  .selected-mark {
    position: absolute;
    top: -7px;
    right: -7px;
    width: 23px;
    height: 23px;
    background: var(--accent);
    color: #283228;
    border-radius: 50%;
    border: 2px solid var(--surface);
    display: grid;
    place-items: center;
  }
  .hand-hint {
    font-size: 10px;
    text-align: center;
    color: #899689;
    margin: 0 16px 14px;
  }
  .empty-hand {
    height: 106px;
    display: grid;
    align-content: center;
    color: var(--muted);
    font-size: 13px;
  }
  @media (hover: hover) and (pointer: fine) {
    .hand-slot:hover {
      z-index: 3;
    }
    .hand-card:not(:disabled):hover {
      opacity: 1;
    }
  }
  @media (max-width: 699px) {
    .hand-heading {
      padding: 0 20px;
    }
    .hand-scroll {
      padding-left: 18px;
      padding-right: 18px;
      padding-top: 23px;
    }
    .hand-track {
      --card-width: 84px;
      --step: max(44px, min(62px, calc((100cqw - 124px) / 6)));
    }
    .hand-section {
      padding-top: 7px;
    }
    .hand-heading .sort {
      min-height: 32px;
    }
    .hand-scroll {
      padding-bottom: 5px;
    }
    .hand-hint {
      margin-bottom: 10px;
    }
  }
  @media (max-height: 800px) and (max-width: 699px) {
    .hand-track {
      --card-width: 76px;
    }
    .hand-scroll {
      padding-top: 20px;
    }
    .hand-hint {
      font-size: 9px;
    }
  }
  @media (max-height: 650px) and (max-width: 699px) {
    .hand-section {
      padding-top: 4px;
    }
    .hand-track {
      --card-width: 64px;
    }
    .hand-scroll {
      padding-top: 17px;
      padding-bottom: 2px;
    }
    .hand-hint {
      display: none;
    }
    .hand-card.selected {
      transform-origin: center;
    }
  }
  @media (min-width: 700px) and (max-height: 1100px) {
    .hand-section {
      padding-top: 7px;
    }
    .hand-track {
      --card-width: 88px;
      --step: 56px;
    }
    .hand-scroll {
      padding-top: 20px;
      padding-bottom: 7px;
    }
    .hand-hint {
      margin-bottom: 10px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .hand-card {
      transition: opacity 120ms ease;
    }
  }
  :global(.gentle) .hand-card {
    transition: opacity 120ms ease;
  }
</style>
