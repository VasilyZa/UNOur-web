<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import GameScreen from '../lib/components/GameScreen.svelte'
  import { ApiError, errorMessage } from '../lib/http'
  import type { AdminClient } from './api'
  import { BotGameConnection } from './bot-game'
  import type { BotControlSession } from './types'

  let {
    client,
    control,
    reduced,
    onerror,
    onclose,
  }: {
    client: AdminClient
    control: BotControlSession
    reduced: boolean
    onerror: (error: unknown) => void
    onclose: (message?: string) => void
  } = $props()
  const game = untrack(() => new BotGameConnection(client, control))
  const name = untrack(
    () =>
      control.room.state.players.find(
        (player) => player.id === control.room.state.you,
      )?.name ?? 'Bot',
  )
  let closing = $state(false)
  let error = $state('')
  let alive = true

  async function close() {
    if (closing) return
    closing = true
    error = ''
    try {
      await game.leave(game.session)
      if (alive) onclose()
    } catch (value) {
      if (alive) {
        error = errorMessage(value)
        onerror(value)
      }
    } finally {
      if (alive) closing = false
    }
  }
  function lost(value: ApiError) {
    onerror(value)
    onclose(
      value.code === 'bot_control_lost'
        ? '操作已结束，电脑已恢复自动行动。'
        : errorMessage(value),
    )
  }
  onDestroy(() => {
    alive = false
    // Explicit navigation releases immediately; a disconnected browser is
    // bounded by the server lease even when this request cannot be delivered.
    void game.leave(game.session).catch(() => {})
  })
</script>

<section class="admin-bot-play" aria-label={`${name} 牌局视角`}>
  <div class="admin-bot-toolbar">
    <strong>{name}</strong>
    <button class="admin-button" disabled={closing} onclick={close}>
      {closing ? '正在返回…' : '返回房间管理'}
    </button>
  </div>
  {#if error}<p class="admin-error" role="alert">{error}</p>{/if}
  <GameScreen
    api={game}
    session={game.session}
    initialRoom={control.room}
    {reduced}
    roomManagement={false}
    exitLabel="返回房间管理"
    onleave={() => onclose()}
    onSessionLost={lost}
  />
</section>

<style>
  .admin-bot-play {
    min-width: 0;
  }
  .admin-bot-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin: 8px 0 20px;
  }
  .admin-bot-toolbar strong {
    font-size: 16px;
  }
</style>
