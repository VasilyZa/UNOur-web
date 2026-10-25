<script lang="ts">
  import { onMount } from 'svelte'
  import type { AdminClient } from './api'
  import { LiveResource } from './live.svelte'
  import {
    phaseNames,
    type DeleteTarget,
    type RoomFilters,
    type RoomSummary,
  } from './types'
  import Pager from './Pager.svelte'
  import RoomInspector from './RoomInspector.svelte'
  import DeleteRooms from './DeleteRooms.svelte'

  let {
    client,
    onerror,
  }: { client: AdminClient; onerror: (error: unknown) => void } = $props()
  let selected = $state('')
  let offset = $state(0)
  let search = $state('')
  let filters = $state<RoomFilters>({ sort: 'activity' })
  let choices = $state<DeleteTarget[]>([])
  let targets = $state<DeleteTarget[] | null>(null)
  let reduced = $state(false)
  const resource = new LiveResource(
    (signal) => client.rooms(filters, offset, signal),
    (error) => onerror(error),
  )
  let allChecked = $derived(
    !!resource.data?.rooms.length && resource.data.rooms.every(isChecked),
  )
  $effect(() => {
    const rooms = resource.data?.rooms
    if (rooms && !targets) {
      // Never silently attach old consent to a new room instance or phase.
      const valid = choices.filter((choice) =>
        rooms.some(
          (room) =>
            room.id === choice.id &&
            room.instance === choice.instance &&
            room.phase === choice.phase,
        ),
      )
      if (valid.length !== choices.length) choices = valid
    }
  })
  onMount(() => {
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    resource.start()
    return () => resource.dispose()
  })
  function isChecked(room: RoomSummary) {
    return choices.some(
      (choice) =>
        choice.id === room.id &&
        choice.instance === room.instance &&
        choice.phase === room.phase,
    )
  }
  function guard(room: RoomSummary): DeleteTarget {
    return { id: room.id, instance: room.instance, phase: room.phase }
  }
  function choose(room: RoomSummary, checked: boolean) {
    choices = choices.filter((choice) => choice.id !== room.id)
    if (checked) choices = [...choices, guard(room)]
  }
  function applyFilters(next: RoomFilters) {
    filters = next
    offset = 0
    choices = []
    void resource.refresh()
  }
  function searchRooms(event: SubmitEvent) {
    event.preventDefault()
    applyFilters({ ...filters, q: search.trim() })
  }
  function enter(id: string) {
    resource.stop()
    choices = []
    selected = id
  }
  function back() {
    selected = ''
    resource.start()
  }
  function closeDelete() {
    targets = null
    choices = []
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
      <p>{resource.data?.total ?? '—'} 个匹配房间 · 自动刷新</p>
    </div>
    <button
      class="admin-button"
      onclick={() => resource.refresh()}
      disabled={resource.loading || !!targets}>刷新</button
    >
  </div>
  <div class="admin-room-stats" aria-label="全部房间统计">
    <div>
      <span>全部房间</span><strong>{resource.data?.stats.total ?? '—'}</strong>
    </div>
    <div>
      <span>等待开局</span><strong>{resource.data?.stats.lobby ?? '—'}</strong>
    </div>
    <div>
      <span>进行中</span><strong>{resource.data?.stats.playing ?? '—'}</strong>
    </div>
    <div>
      <span>已结束</span><strong>{resource.data?.stats.finished ?? '—'}</strong>
    </div>
  </div>
  <form class="admin-search" onsubmit={searchRooms}>
    <input
      aria-label="搜索房间或成员"
      placeholder="房间号 / 成员名称"
      maxlength="64"
      bind:value={search}
      type="search"
    />
    <button class="admin-button" type="submit" disabled={!!targets}>搜索</button
    >
  </form>
  <div class="admin-room-filters">
    <label
      >阶段<select
        value={filters.phase ?? ''}
        onchange={(e) =>
          applyFilters({
            ...filters,
            phase: e.currentTarget.value as RoomFilters['phase'],
          })}
        ><option value="">全部阶段</option><option value="lobby"
          >等待开局</option
        ><option value="playing">进行中</option><option value="finished"
          >已结束</option
        ></select
      ></label
    >
    <label
      >类型<select
        value={filters.kind ?? ''}
        onchange={(e) =>
          applyFilters({
            ...filters,
            kind: e.currentTarget.value as RoomFilters['kind'],
          })}
        ><option value="">全部类型</option><option value="human"
          >真人房间</option
        ><option value="bot">含 Bot</option></select
      ></label
    >
    <label
      >加入权限<select
        value={filters.access ?? ''}
        onchange={(e) =>
          applyFilters({
            ...filters,
            access: e.currentTarget.value as RoomFilters['access'],
          })}
        ><option value="">全部权限</option><option value="open">开放加入</option
        ><option value="locked">已锁定</option></select
      ></label
    >
    <label
      >排序<select
        value={filters.sort ?? 'activity'}
        onchange={(e) =>
          applyFilters({
            ...filters,
            sort: e.currentTarget.value as RoomFilters['sort'],
          })}
        ><option value="activity">最近活跃</option><option value="oldest"
          >最久未活跃</option
        ><option value="created">最近创建</option><option value="members"
          >成员最多</option
        ></select
      ></label
    >
  </div>
  {#if resource.error}<p class="admin-error" role="alert">
      {resource.error}
    </p>{/if}
  <div class="admin-bulk-bar">
    <label class="admin-check"
      ><input
        type="checkbox"
        checked={allChecked}
        disabled={!resource.data?.rooms.length || resource.loading || !!targets}
        onchange={(e) => {
          choices = e.currentTarget.checked
            ? resource.data!.rooms.map(guard)
            : []
        }}
      />全选本页</label
    >
    <span class="admin-muted">已选 {choices.length}</span>
    <button
      class="admin-button danger"
      disabled={!choices.length || !!targets || resource.loading}
      onclick={() => {
        targets = choices.map((choice) => ({ ...choice }))
        resource.stop()
      }}>批量解散 / 删除</button
    >
  </div>
  <div class="admin-room-grid" aria-busy={resource.loading}>
    {#each resource.data?.rooms ?? [] as room (room.id)}
      <article
        class="admin-panel admin-room-selectable"
        class:chosen={isChecked(room)}
      >
        <div class="admin-room-select-heading">
          <label class="admin-check"
            ><input
              type="checkbox"
              aria-label={`选择房间 ${room.id}`}
              checked={isChecked(room)}
              disabled={resource.loading || !!targets}
              onchange={(e) => choose(room, e.currentTarget.checked)}
            />选择</label
          >
          <span class="admin-badge" class:live={room.phase === 'playing'}
            >{phaseNames[room.phase]}</span
          >
        </div>
        <button class="admin-room-open" onclick={() => enter(room.id)}>
          <span class="admin-room-id">{room.id}</span>
          <span class="admin-room-owner"
            >{room.host_name
              ? `房主 ${room.host_name}`
              : '暂无成员'}{room.join_locked ? ' · 已锁定' : ''}</span
          >
          <span class="admin-muted"
            >{room.players} 人在座 · {room.bots} 个 Bot · {room.spectators} 人观战</span
          >
          <span class="admin-room-activity"
            >活跃于 <time datetime={room.updated_at}
              >{new Date(room.updated_at).toLocaleString('zh-CN', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}</time
            ><span aria-hidden="true">↗</span></span
          >
        </button>
      </article>
    {/each}
  </div>
  {#if resource.data?.rooms.length === 0}<p class="admin-placeholder">
      没有匹配的房间。
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
      choices = []
      void resource.refresh()
    }}
  />
  {#if targets}
    <DeleteRooms
      {targets}
      {client}
      {reduced}
      {onerror}
      oncomplete={() => {
        choices = []
        offset = 0
      }}
      onclose={closeDelete}
    />
  {/if}
{/if}
