<script lang="ts">
  import Icon from './Icon.svelte'
  import type { Room } from '../game/types'
  let {
    room,
    busy,
    invite,
    participate,
    dissolve,
    leave,
  }: {
    room: Room
    busy: boolean
    invite: (codeOnly?: boolean, watch?: boolean) => Promise<void>
    participate: (nextRound: boolean) => void
    dissolve: () => void
    leave: () => void
  } = $props()
  let confirming = $state(false)
  let confirmLeave = $state(false)
  let observer = $derived(room.spectators?.find((p) => p.id === room.state.you))
</script>

<div class="room-panel-content">
  <div class="invite-code">
    <span>房间号 · 第 {room.round ?? 1} 局</span><strong>{room.id}</strong>
    <button class="button secondary" onclick={() => void invite(true)}
      ><Icon name="copy" size={16} />复制房间号</button
    >
  </div>
  <div class="invite-actions">
    <button class="button primary" onclick={() => void invite()}
      ><Icon name="link" size={16} />邀请玩家</button
    >
    <button class="button secondary" onclick={() => void invite(false, true)}
      >邀请观战</button
    >
  </div>
  <p class="form-tip">局中加入先观战，下一局入座；仅观战不占座位。</p>
  <section aria-label="房间成员" class="room-roster">
    {#each room.state.players as player (player.id)}
      <div class="member-row">
        <span class="member-name"
          >{player.name}{player.id === room.state.you ? '（你）' : ''}</span
        >
        <span class="member-status"
          >{room.departed?.includes(player.id)
            ? '已离开'
            : player.id === room.host_id
              ? '房主'
              : room.bots?.[player.id]
                ? '电脑'
                : '玩家'}</span
        >
      </div>
    {/each}
    {#each room.spectators ?? [] as player (player.id)}
      <div class="member-row">
        <span class="member-name"
          >{player.name}{player.id === room.state.you ? '（你）' : ''}</span
        >
        <span class="member-status"
          >{player.next_round ? '下一局入座' : '观战中'}</span
        >
      </div>
    {/each}
  </section>
  {#if observer}
    <button
      class="button secondary full"
      disabled={busy}
      onclick={() => participate(!observer?.next_round)}
      >{observer.next_round
        ? '取消下一局入座'
        : room.state.phase === 'lobby'
          ? '入座'
          : '报名下一局'}</button
    >
  {/if}
  <div class="account-separator"></div>
  {#if room.host_id === room.state.you}
    {#if confirming}
      <div class="dissolve-confirm" role="alert">
        <strong>解散这个房间？</strong>
        <p>当前牌局将结束，所有玩家与观战者都会离开房间。</p>
        <div class="invite-actions">
          <button
            class="button secondary"
            disabled={busy}
            onclick={() => (confirming = false)}>保留房间</button
          >
          <button class="button danger" disabled={busy} onclick={dissolve}
            >确认解散</button
          >
        </div>
      </div>
    {:else}
      <button
        class="button secondary full"
        disabled={busy}
        onclick={() => (confirming = true)}>解散房间</button
      >
    {/if}
  {/if}
  {#if confirmLeave}
    <div class="dissolve-confirm" role="alert">
      <strong>退出当前牌局？</strong>
      <p>退出按弃权处理，房主权限会自动交给仍在房间内的玩家。</p>
      <div class="invite-actions">
        <button
          class="button secondary"
          disabled={busy}
          onclick={() => (confirmLeave = false)}>继续游戏</button
        ><button class="button danger" disabled={busy} onclick={leave}
          >确认退出</button
        >
      </div>
    </div>
  {:else}
    <button
      class="text-button leave-room"
      disabled={busy}
      onclick={() => {
        if (!observer && room.state.phase === 'playing') confirmLeave = true
        else leave()
      }}>{observer ? '退出观战' : '退出房间'}</button
    >
  {/if}
</div>

<style>
  .room-panel-content {
    display: grid;
    gap: 12px;
  }
  .invite-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .invite-actions .button {
    min-width: 0;
    padding-inline: 10px;
  }
  .room-roster {
    max-height: 220px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .member-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 4px;
  }
  .member-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    font-size: 13px;
  }
  .member-status {
    font-size: 11px;
    opacity: 0.65;
    flex-shrink: 0;
  }
  .leave-room {
    justify-self: center;
    min-height: 44px;
  }
  .dissolve-confirm {
    padding: 14px;
    border: 1px solid currentColor;
    border-radius: 14px;
  }
  .dissolve-confirm p {
    font-size: 12px;
    line-height: 1.7;
    margin: 8px 0 14px;
  }
  .danger {
    background: #a52f3e;
    color: white;
  }
</style>
