<script lang="ts">
  import { onMount } from 'svelte'
  import CardFace from '../lib/components/CardFace.svelte'
  import { cardName } from '../lib/game/types'
  import { errorMessage } from '../lib/http'
  import type { AdminClient } from './api'
  import { LiveResource } from './live.svelte'
  import { phaseNames, type CardChange, type BotControlSession } from './types'
  import CardEditor from './CardEditor.svelte'
  import RoomControls from './RoomControls.svelte'
  import BotPlay from './BotPlay.svelte'

  let {
    id,
    client,
    onerror,
    onback,
  }: {
    id: string
    client: AdminClient
    onerror: (error: unknown) => void
    onback: () => void
  } = $props()
  const resource = new LiveResource(
    (signal) => client.room(id, signal),
    (error) => onerror(error),
    1000,
  )
  let selection = $state<{ playerId: string; cardId?: number } | null>(null)
  let busy = $state(false)
  let error = $state('')
  let notice = $state('')
  let reduced = $state(false)
  let control = $state.raw<BotControlSession | null>(null)
  onMount(() => {
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    resource.start()
    return () => resource.dispose()
  })
  async function apply(edit: CardChange) {
    const room = resource.data
    if (!room || busy) return
    busy = true
    error = ''
    notice = ''
    resource.stop()
    try {
      const updated = await client.edit(id, {
        ...edit,
        instance: room.instance,
        expected_version: room.state.version,
        expected_revision: room.revision,
      })
      resource.accept(updated)
      selection = null
      notice = '手牌已更新。'
    } catch (value) {
      error = errorMessage(value)
      onerror(value)
    } finally {
      busy = false
      resource.start()
    }
  }
  async function operate(playerId: string) {
    const room = resource.data
    if (!room || busy) return
    busy = true
    error = ''
    notice = ''
    selection = null
    resource.stop()
    try {
      control = await client.acquireBot(id, playerId, room.instance)
    } catch (value) {
      error = errorMessage(value)
      onerror(value)
    } finally {
      busy = false
      if (!control) resource.start()
    }
  }
  function returnToInspection(message = '') {
    control = null
    notice = message
    error = ''
    resource.start()
  }
</script>

{#if control}
  <BotPlay
    {client}
    {control}
    {reduced}
    {onerror}
    onclose={returnToInspection}
  />
{:else}
  <button
    class="admin-button subtle admin-back"
    onclick={onback}
    disabled={busy}>← 房间列表</button
  >
  <div class="admin-section-heading">
    <div>
      <h1 class="admin-room-id">{id}</h1>
      <p>
        {resource.data
          ? `${phaseNames[resource.data.state.phase]} · 第 ${resource.data.round} 局`
          : '房间详情'}
      </p>
    </div>
    <span class="admin-badge" class:live={!resource.error}
      >{resource.error ? '连接异常' : '实时'}</span
    >
  </div>
  {#if resource.error}<div class="admin-notice">
      <p class="admin-error" role="alert">{resource.error}</p>
      <button
        class="admin-button"
        onclick={() => resource.refresh()}
        disabled={resource.loading}>重新连接</button
      >
    </div>{/if}
  {#if notice}<p class="admin-notice" role="status">{notice}</p>{/if}
  {#if error && !selection}<p class="admin-error" role="alert">{error}</p>{/if}
  {#if resource.data}
    {@const room = resource.data}
    <section class="admin-table-status admin-panel" aria-label="牌桌状态">
      {#if room.state.top_card}<div class="admin-top-card">
          <CardFace card={room.state.top_card} />
        </div>{/if}
      <div>
        <p>当前回合</p>
        <strong
          >{room.state.players.find((p) => p.id === room.state.turn)?.name ??
            '—'}</strong
        >
        <p>
          牌堆 {room.state.draw_pile_count} · 弃牌 {room.state
            .discard_count}{#if room.state.pending_draw}
            · 待摸 +{room.state.pending_draw}{/if}
        </p>
      </div>
    </section>
    <RoomControls
      {room}
      {client}
      {busy}
      {reduced}
      {onerror}
      onbegin={() => {
        busy = true
        notice = ''
        resource.stop()
      }}
      onend={() => {
        busy = false
        resource.start()
      }}
      onupdated={(updated) => {
        resource.accept(updated)
        notice = '房间已更新。'
      }}
      onremoved={onback}
    />
    <div class="admin-hands">
      {#each room.state.players as player (player.id)}
        <section
          class="admin-player-hand admin-panel"
          class:current={room.state.turn === player.id}
        >
          <header>
            <div>
              <h2>
                {player.name}{#if room.bots?.[player.id]}<span
                    class="admin-badge">Bot</span
                  >{/if}
              </h2>
              <p>
                {player.hand_count} 张{#if player.eliminated}
                  · 已出局{:else if room.state.turn === player.id}
                  · 当前回合{/if}
              </p>
            </div>
            <div class="admin-player-actions">
              {#if room.bots?.[player.id] && room.state.phase === 'playing' && !player.eliminated}
                <button
                  class="admin-button"
                  disabled={busy}
                  onclick={() => void operate(player.id)}>以此身份打牌</button
                >
              {/if}
              {#if room.state.phase === 'playing' && !player.eliminated}<button
                  class="admin-button"
                  disabled={busy || !room.deck?.length}
                  onclick={() => {
                    error = ''
                    selection = { playerId: player.id }
                  }}>加牌</button
                >{/if}
            </div>
          </header>
          <div class="admin-card-grid">
            {#each player.hand ?? [] as card (card.id)}
              <button
                class="admin-card"
                title={cardName(card)}
                aria-label={`编辑 ${player.name} 的${cardName(card)}，编号 ${card.id}`}
                disabled={busy ||
                  player.eliminated ||
                  room.state.phase !== 'playing'}
                onclick={() => {
                  error = ''
                  selection = { playerId: player.id, cardId: card.id }
                }}><CardFace {card} /><small>#{card.id}</small></button
              >
            {/each}
          </div>
        </section>
      {/each}
    </div>
    {#if selection}
      {#key `${selection.playerId}:${selection.cardId ?? 'add'}`}
        <CardEditor
          {room}
          {selection}
          {busy}
          {error}
          {reduced}
          onapply={apply}
          onclose={() => {
            if (!busy) selection = null
          }}
        />
      {/key}
    {/if}
  {:else if resource.loading}<p class="admin-placeholder" role="status">
      正在加载牌局…
    </p>{/if}
{/if}

<style>
  .admin-player-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
