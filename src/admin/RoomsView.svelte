<script lang="ts">
  import { onMount } from 'svelte'
  import type { AdminClient } from './api'
  import { LiveResource } from './live.svelte'
  import { phaseNames } from './types'
  import Pager from './Pager.svelte'
  import RoomInspector from './RoomInspector.svelte'

  let {
    client,
    onerror,
  }: { client: AdminClient; onerror: (error: unknown) => void } = $props()
  let selected = $state('')
  let offset = $state(0)
  const resource = new LiveResource(
    (signal) => client.rooms(offset, signal),
    (error) => onerror(error),
  )
  onMount(() => {
    resource.start()
    return () => resource.dispose()
  })
  function enter(id: string) {
    resource.stop()
    selected = id
  }
  function back() {
    selected = ''
    resource.start()
  }
</script>

{#if selected}
  {#key selected}<RoomInspector
      id={selected}
      {client}
      {onerror}
      onback={back}
    />{/key}
{:else}
  <div class="admin-section-heading">
    <div>
      <h1>实时房间</h1>
      <p>{resource.data?.total ?? '—'} 个房间 · 自动刷新</p>
    </div>
    <button
      class="admin-button"
      onclick={() => resource.refresh()}
      disabled={resource.loading}>刷新</button
    >
  </div>
  {#if resource.error}<p class="admin-error" role="alert">
      {resource.error}
    </p>{/if}
  <div class="admin-room-grid">
    {#each resource.data?.rooms ?? [] as room (room.id)}
      <button
        class="admin-room-card admin-panel"
        onclick={() => enter(room.id)}
      >
        <div class="admin-room-card-top">
          <span class="admin-room-id">{room.id}</span><span
            class="admin-badge"
            class:live={room.phase === 'playing'}>{phaseNames[room.phase]}</span
          >
        </div>
        <p>{room.players} 人 · {room.bots} 个 Bot · {room.spectators} 人观战</p>
        <span class="admin-muted"
          >第 {room.round} 局 <span aria-hidden="true">↗</span></span
        >
      </button>
    {/each}
  </div>
  {#if resource.data?.rooms.length === 0}<p class="admin-placeholder">
      暂无房间。
    </p>{:else if !resource.data && resource.loading}<p
      class="admin-placeholder"
      role="status"
    >
      正在加载房间…
    </p>{/if}
  <Pager
    total={resource.data?.total ?? 0}
    {offset}
    onchange={(value) => {
      offset = value
      void resource.refresh()
    }}
  />
{/if}
