<script lang="ts">
  import Sheet from '../lib/components/Sheet.svelte'
  import { errorMessage } from '../lib/http'
  import type { AdminClient } from './api'
  import {
    phaseNames,
    type DeleteBatch,
    type DeleteStatus,
    type DeleteTarget,
  } from './types'

  let {
    targets,
    client,
    reduced,
    oncomplete,
    onerror,
    onclose,
  }: {
    targets: DeleteTarget[]
    client: AdminClient
    reduced: boolean
    oncomplete: (result: DeleteBatch) => void
    onerror: (error: unknown) => void
    onclose: () => void
  } = $props()
  let busy = $state(false)
  let attempted = $state(false)
  let result = $state<DeleteBatch | null>(null)
  let error = $state('')
  const names: Record<DeleteStatus, string> = {
    deleted: '已永久删除',
    not_found: '已不存在',
    changed: '房间已变化，未删除',
    failed: '删除失败，未确认删除',
  }
  async function submit() {
    if (busy || attempted) return
    busy = true
    attempted = true
    try {
      result = await client.deleteRooms(targets)
      oncomplete(result)
    } catch (value) {
      error = errorMessage(value)
      onerror(value)
    } finally {
      busy = false
    }
  }
</script>

<Sheet
  open
  title={result ? '操作结果' : '永久删除房间'}
  {reduced}
  onclose={() => {
    if (!busy) onclose()
  }}
>
  <div class="admin-action-form">
    {#if result}
      <p role="status">已删除 {result.deleted} / {targets.length} 个房间。</p>
      <ul class="admin-target-list">
        {#each result.results as item (item.id)}
          <li>
            <strong>{item.id}</strong><span
              class:admin-error={item.status === 'changed' ||
                item.status === 'failed'}>{names[item.status]}</span
            >
          </li>
        {/each}
      </ul>
      {#if result.results.some((item) => item.status === 'changed' || item.status === 'failed')}
        <p class="admin-muted">关闭后刷新列表，重新检查并选择未删除的房间。</p>
      {/if}
    {:else}
      <p>
        将立即解散以下 {targets.length} 个房间，并永久删除其中的牌局、手牌和成员数据。此操作无法撤销。
      </p>
      {#if targets.some((room) => room.phase === 'playing')}<p
          class="admin-error"
        >
          包含正在进行的牌局，所有成员将退出房间。
        </p>{/if}
      <ul class="admin-target-list">
        {#each targets as room (room.id)}<li>
            <strong>{room.id}</strong><span>{phaseNames[room.phase]}</span>
          </li>{/each}
      </ul>
      {#if error}<p class="admin-error" role="alert">{error}</p>
        <p class="admin-muted">
          请求可能已经执行，请关闭后刷新列表核对结果。
        </p>{/if}
    {/if}
    <div class="admin-form-actions">
      <button class="admin-button" disabled={busy} onclick={onclose}
        >{result || error ? '关闭' : '取消'}</button
      >
      {#if !attempted || busy}<button
          class="admin-button danger"
          disabled={busy}
          onclick={submit}>{busy ? '正在删除…' : '永久删除'}</button
        >{/if}
    </div>
  </div>
</Sheet>
