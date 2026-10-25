<script lang="ts">
  import type { Room } from '../game/types'
  let {
    room,
    busy,
    vote,
  }: { room: Room; busy: boolean; vote: (agree: boolean) => void } = $props()
  let roster = $derived([
    ...room.state.players.filter(
      (p) => !room.bots?.[p.id] && !room.departed?.includes(p.id),
    ),
    ...(room.spectators ?? []).filter((p) => p.next_round),
  ])
  let votes = $derived(room.rematch_votes ?? [])
  let eligible = $derived(roster.some((p) => p.id === room.state.you))
  let agreed = $derived(votes.includes(room.state.you))
</script>

<section class="rematch-panel" aria-label="再来一局">
  <div class="rematch-heading">
    <strong>再来一局</strong><span aria-live="polite"
      >{votes.length} / {roster.length} 人同意</span
    >
  </div>
  <div class="rematch-members">
    {#each roster as player (player.id)}<span
        class:agreed={votes.includes(player.id)}
        >{votes.includes(player.id) ? '✓' : '·'} {player.name}</span
      >{/each}
  </div>
  <p>
    全体参赛玩家同意后自动发牌{Object.keys(room.bots ?? {}).length
      ? '，电脑自动同意'
      : ''}。
  </p>
  {#if eligible}
    <button
      class="button full"
      class:primary={!agreed}
      class:secondary={agreed}
      disabled={busy}
      onclick={() => vote(!agreed)}
      >{busy ? '正在确认…' : agreed ? '已同意 · 撤回' : '同意再来一局'}</button
    >
  {:else}
    <p>你正在观战，可在房间面板中报名下一局。</p>
  {/if}
</section>

<style>
  .rematch-panel {
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: 18px;
    margin: 14px 0;
  }
  .rematch-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .rematch-heading strong {
    font-size: 14px;
  }
  .rematch-heading span,
  p {
    font-size: 12px;
    opacity: 0.65;
    line-height: 1.7;
  }
  .rematch-members {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    margin-top: 12px;
  }
  .rematch-members span {
    font-size: 12px;
    max-width: 100%;
    overflow-wrap: anywhere;
    opacity: 0.5;
  }
  .rematch-members .agreed {
    opacity: 1;
  }
</style>
