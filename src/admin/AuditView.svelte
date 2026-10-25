<script lang="ts">
  import { onMount } from 'svelte'
  import type { AdminClient } from './api'
  import { LiveResource } from './live.svelte'
  import Pager from './Pager.svelte'
  let {
    client,
    onerror,
  }: { client: AdminClient; onerror: (error: unknown) => void } = $props()
  let offset = $state(0)
  const resource = new LiveResource(
    (signal) => client.audit(offset, signal),
    (error) => onerror(error),
  )
  const names: Record<string, string> = {
    'room.cards': '编辑手牌',
    'room.delete': '永久删除房间',
    'room.access': '更改房间加入权限',
    'room.kick': '移出房间成员',
    'user.status': '更改封禁状态',
    'user.password': '重置密码',
    'user.revoke': '强制退出',
  }
  onMount(() => {
    resource.start()
    return () => resource.dispose()
  })
</script>

<div class="admin-section-heading">
  <div>
    <h1>操作记录</h1>
    <p>{resource.data?.total ?? '—'} 条记录</p>
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
<div class="admin-audit-list">
  {#each resource.data?.entries ?? [] as entry (entry.id)}
    <article class="admin-audit admin-panel">
      <div>
        <h2>{names[entry.action] ?? entry.action}</h2>
        <time datetime={entry.at}
          >{new Date(entry.at).toLocaleString('zh-CN', { hour12: false })}</time
        >
      </div>
      <code>{entry.target}</code>{#if entry.detail}<p>{entry.detail}</p>{/if}
    </article>
  {/each}
</div>
{#if resource.data?.entries.length === 0}<p class="admin-placeholder">
    暂无操作记录。
  </p>{/if}
<Pager
  total={resource.data?.total ?? 0}
  {offset}
  onchange={(value) => {
    offset = value
    void resource.refresh()
  }}
/>
