<script lang="ts">
  import { cardSymbol, type Card } from '../game/types'
  let { card, back = false }: { card?: Card; back?: boolean } = $props()
  const colors = {
    red: '#e77c6a',
    yellow: '#e9bf59',
    green: '#77a990',
    blue: '#6b9fca',
    wild: '#292f30',
  }
</script>

<svg class="card-face" viewBox="0 0 100 144" fill="none" aria-hidden="true">
  <rect x="1" y="1" width="98" height="142" rx="11" fill="#f4eddf" />
  <rect
    x="5.5"
    y="5.5"
    width="89"
    height="133"
    rx="7"
    fill={back ? '#343b48' : colors[card?.color || 'red']}
  />
  {#if back}
    <rect
      x="12"
      y="12"
      width="76"
      height="120"
      rx="4"
      stroke="#e1dcc4"
      stroke-opacity=".45"
      stroke-width=".7"
    />
    <path
      d="m12 41 76-25M12 57l76-25M12 73l76-25M12 89l76-25M12 105l76-25M12 121l76-25"
      stroke="#e1dcc4"
      stroke-opacity=".07"
      stroke-width="8"
    />
    <ellipse
      cx="50"
      cy="72"
      rx="31"
      ry="41"
      transform="rotate(28 50 72)"
      fill="#e9e4d3"
    />
    <text
      x="49"
      y="80"
      text-anchor="middle"
      transform="rotate(-14 50 72)"
      fill="#343b48"
      font-size="24"
      font-weight="900"
      letter-spacing="-1.5">our.</text
    >
    <path
      d="M26 105h9m3 0h9m3 0h9m3 0h9"
      stroke="#e9e4d3"
      stroke-width="2"
      stroke-linecap="round"
    />
  {:else if card}
    <ellipse
      cx="50"
      cy="72"
      rx="32"
      ry="48"
      transform="rotate(30 50 72)"
      fill="#fff6e7"
    />
    {#if card.color === 'wild'}
      <g transform="rotate(22 50 72)">
        <path d="M50 35a37 37 0 0 0-24 37h24Z" fill={colors.red} />
        <path d="M50 35a37 37 0 0 1 24 37H50Z" fill={colors.blue} />
        <path d="M50 109a37 37 0 0 1-24-37h24Z" fill={colors.yellow} />
        <path d="M50 109a37 37 0 0 0 24-37H50Z" fill={colors.green} />
      </g>
      {#if card.kind === 'wild_draw_four'}
        <text
          x="50"
          y="85"
          text-anchor="middle"
          font-size="37"
          font-weight="900"
          fill="#fff7e8"
          stroke="#292f30"
          stroke-width="1.5"
          paint-order="stroke">+4</text
        >
      {/if}
    {:else}
      <text
        x="50"
        y="92"
        text-anchor="middle"
        transform="rotate(-11 50 72)"
        fill={colors[card.color]}
        font-size={card.kind === 'draw_two' ? '45' : '63'}
        font-weight="900"
        letter-spacing="-4">{cardSymbol(card)}</text
      >
    {/if}
    <text x="13" y="24" fill="#fff7e8" font-size="15" font-weight="800"
      >{cardSymbol(card)}</text
    >
    <text
      x="13"
      y="24"
      transform="rotate(180 50 72)"
      fill="#fff7e8"
      font-size="15"
      font-weight="800">{cardSymbol(card)}</text
    >
    {#if card.kind === 'number'}
      <path d="M13 28h9" stroke="#fff7e8" stroke-width="1.5" />
      <path d="M78 116h9" stroke="#fff7e8" stroke-width="1.5" />
    {/if}
  {/if}
  <rect
    x=".5"
    y=".5"
    width="99"
    height="143"
    rx="11.5"
    stroke="white"
    stroke-opacity=".14"
  />
</svg>

<style>
  .card-face {
    font-family: var(--font);
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
</style>
