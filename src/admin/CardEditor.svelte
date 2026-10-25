<script lang="ts">
  import Sheet from '../lib/components/Sheet.svelte'
  import CardFace from '../lib/components/CardFace.svelte'
  import { cardName } from '../lib/game/types'
  import type { AdminRoom, CardChange } from './types'
  let {
    room,
    selection,
    busy,
    error,
    reduced,
    onapply,
    onclose,
  }: {
    room: AdminRoom
    selection: { playerId: string; cardId?: number }
    busy: boolean
    error: string
    reduced: boolean
    onapply: (edit: CardChange) => void
    onclose: () => void
  } = $props()
  let mode = $state<'swap' | 'move'>('swap')
  let group = $state('deck')
  let destination = $state('')
  let replacement = $state(0)
  let color = $state('all')
  let player = $derived(
    room.state.players.find((p) => p.id === selection.playerId),
  )
  let card = $derived(player?.hand?.find((c) => c.id === selection.cardId))
  let adding = $derived(selection.cardId === undefined)
  let activePlayers = $derived(
    room.state.players.filter(
      (p) => !p.eliminated && p.id !== selection.playerId,
    ),
  )
  let candidates = $derived(
    (adding || group === 'deck'
      ? (room.deck ?? [])
      : (activePlayers.find((p) => p.id === group)?.hand ?? [])
    ).filter((c) => color === 'all' || c.color === color),
  )
  let chosen = $derived(candidates.find((c) => c.id === replacement))
  let canRemove = $derived(
    (player?.hand_count ?? 0) > 1 && card?.id !== room.state.drawn_card_id,
  )
  let valid = $derived(
    room.state.phase === 'playing' &&
      !!player &&
      !player.eliminated &&
      (adding ? !!chosen : !!card && (mode === 'swap' ? !!chosen : canRemove)),
  )
  function submit(event: SubmitEvent) {
    event.preventDefault()
    if (!valid || busy) return
    if (adding)
      onapply({
        operation: 'move',
        card_id: replacement,
        to_player_id: selection.playerId,
      })
    else if (mode === 'swap')
      onapply({
        operation: 'swap',
        card_id: selection.cardId!,
        replacement_id: replacement,
      })
    else
      onapply({
        operation: 'move',
        card_id: selection.cardId!,
        to_player_id: destination,
      })
  }
</script>

<Sheet
  open
  title={adding ? '从牌堆加牌' : '编辑手牌'}
  description={player?.name ?? '玩家已离开'}
  {onclose}
  {reduced}
>
  <form class="admin-card-editor" onsubmit={submit}>
    {#if !adding}
      {#if card}<div class="admin-edit-preview">
          <div class="admin-preview-card"><CardFace {card} /></div>
          <div>
            <strong>{cardName(card)}</strong>
            <p class="admin-muted">编号 #{card.id}</p>
          </div>
        </div>
      {:else}<p class="admin-error" role="alert">
          这张牌已离开该玩家的手牌，请重新选择。
        </p>{/if}
      <div class="admin-mode" aria-label="编辑方式">
        <button
          type="button"
          aria-pressed={mode === 'swap'}
          onclick={() => {
            mode = 'swap'
          }}>替换</button
        ><button
          type="button"
          aria-pressed={mode === 'move'}
          onclick={() => {
            mode = 'move'
          }}>移牌</button
        >
      </div>
    {/if}
    {#if adding || mode === 'swap'}
      <div class="admin-editor-filters">
        {#if !adding}<label class="admin-field"
            >替换牌来源<select
              bind:value={group}
              onchange={() => {
                replacement = 0
              }}
              disabled={busy}
              ><option value="deck">牌堆</option
              >{#each activePlayers as other}<option value={other.id}
                  >{other.name}</option
                >{/each}</select
            ></label
          >{/if}
        <label class="admin-field"
          >花色<select
            bind:value={color}
            onchange={() => {
              replacement = 0
            }}
            disabled={busy}
            ><option value="all">全部花色</option><option value="red"
              >红色</option
            ><option value="yellow">黄色</option><option value="green"
              >绿色</option
            ><option value="blue">蓝色</option><option value="wild"
              >万能牌</option
            ></select
          ></label
        >
      </div>
      <div class="admin-picker" aria-label="选择卡牌">
        {#each candidates as candidate (candidate.id)}
          <button
            type="button"
            class="admin-card"
            class:chosen={replacement === candidate.id}
            aria-pressed={replacement === candidate.id}
            aria-label={`选择${cardName(candidate)}，编号 ${candidate.id}`}
            disabled={busy}
            onclick={() => {
              replacement = candidate.id
            }}
            ><CardFace card={candidate} /><small>#{candidate.id}</small></button
          >
        {/each}
      </div>
      {#if candidates.length === 0}<p class="admin-muted">
          没有可选择的牌。
        </p>{/if}
      <p class="admin-muted">
        {adding
          ? '从牌堆移入该玩家手中。'
          : '选中的牌与原手牌交换，牌组总数不变。'}
      </p>
    {:else}
      <label class="admin-field"
        >移至<select bind:value={destination} disabled={busy}
          ><option value="">牌堆底部</option
          >{#each activePlayers as other}<option value={other.id}
              >{other.name}</option
            >{/each}</select
        ></label
      >
      {#if !canRemove}<p class="admin-notice">
          最后一张手牌或刚摸到的牌只能替换。
        </p>{/if}
    {/if}
    {#if error}<p class="admin-error" role="alert">{error}</p>{/if}
    <div class="admin-form-actions">
      <button
        type="button"
        class="admin-button"
        onclick={onclose}
        disabled={busy}>取消</button
      ><button
        type="submit"
        class="admin-button primary"
        disabled={busy || !valid}
        >{busy
          ? '保存中…'
          : adding
            ? '加牌'
            : mode === 'swap'
              ? '确认替换'
              : '确认移牌'}</button
      >
    </div>
  </form>
</Sheet>
