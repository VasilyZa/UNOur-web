<script lang="ts">
  import { onMount } from 'svelte'
  import Sheet from '../lib/components/Sheet.svelte'
  import Avatar from '../lib/components/Avatar.svelte'
  import { errorMessage } from '../lib/http'
  import type { AdminClient } from './api'
  import { LiveResource } from './live.svelte'
  import type { ManagedUser } from './types'
  import Pager from './Pager.svelte'

  let {
    client,
    onerror,
  }: { client: AdminClient; onerror: (error: unknown) => void } = $props()
  let query = $state('')
  let search = $state('')
  let offset = $state(0)
  const resource = new LiveResource(
    (signal) => client.users(search, offset, signal),
    (error) => onerror(error),
  )
  let selected = $state<ManagedUser | null>(null)
  let action = $state<'status' | 'revoke' | 'password'>('status')
  let password = $state('')
  let busy = $state(false)
  let error = $state('')
  let notice = $state('')
  let reduced = $state(false)
  let validPassword = $derived(
    Array.from(password).length >= 8 && Array.from(password).length <= 14,
  )
  let title = $derived(
    action === 'password'
      ? '重置密码'
      : action === 'revoke'
        ? '强制退出'
        : selected?.disabled
          ? '解除封禁'
          : '封禁用户',
  )
  onMount(() => {
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    resource.start()
    return () => resource.dispose()
  })
  function open(user: ManagedUser, kind: typeof action) {
    selected = user
    action = kind
    password = ''
    error = ''
    notice = ''
  }
  function close() {
    if (!busy) {
      selected = null
      password = ''
      error = ''
    }
  }
  async function submit(event: SubmitEvent) {
    event.preventDefault()
    if (!selected || busy || (action === 'password' && !validPassword)) return
    busy = true
    error = ''
    try {
      if (action === 'status')
        await client.status(selected.id, !selected.disabled)
      else if (action === 'revoke') await client.revoke(selected.id)
      else await client.resetPassword(selected.id, password)
      notice = `${selected.username}：${title}已完成。`
      selected = null
      password = ''
      await resource.refresh()
    } catch (value) {
      error = errorMessage(value)
      onerror(value)
    } finally {
      busy = false
      password = ''
    }
  }
  function changePage(value: number) {
    offset = value
    void resource.refresh()
  }
</script>

<div class="admin-section-heading">
  <div>
    <h1>用户</h1>
    <p>{resource.data?.total ?? '—'} 个账户</p>
  </div>
  <button
    class="admin-button"
    onclick={() => resource.refresh()}
    disabled={resource.loading}>刷新</button
  >
</div>
<form
  class="admin-search"
  onsubmit={(event) => {
    event.preventDefault()
    search = query.trim()
    offset = 0
    void resource.refresh()
  }}
>
  <label class="sr-only" for="user-search">搜索用户名</label>
  <input
    id="user-search"
    type="search"
    placeholder="搜索用户名"
    bind:value={query}
    enterkeyhint="search"
    maxlength="96"
  />
  <button class="admin-button" type="submit">搜索</button>
</form>
{#if resource.error}<p class="admin-error" role="alert">
    {resource.error}
  </p>{/if}
{#if notice}<p class="admin-notice" role="status">{notice}</p>{/if}
<div class="admin-user-list">
  {#each resource.data?.users ?? [] as user (user.id)}
    <article class="admin-user admin-panel">
      <div class="admin-user-identity">
        <Avatar src={user.avatar_url} />
        <div>
          <h2>{user.username}</h2>
          <p>
            {user.disabled ? '已封禁' : '正常'} · {user.active_sessions} 个登录设备
          </p>
        </div>
      </div>
      <div class="admin-user-actions">
        <button class="admin-button" onclick={() => open(user, 'revoke')}
          >强制退出</button
        >
        <button class="admin-button" onclick={() => open(user, 'password')}
          >重置密码</button
        >
        <button
          class:danger={!user.disabled}
          class="admin-button"
          onclick={() => open(user, 'status')}
          >{user.disabled ? '解封' : '封禁'}</button
        >
      </div>
    </article>
  {/each}
</div>
{#if resource.data?.users.length === 0}<p class="admin-placeholder">
    没有找到用户。
  </p>{:else if !resource.data && resource.loading}<p
    class="admin-placeholder"
    role="status"
  >
    正在加载用户…
  </p>{/if}
<Pager total={resource.data?.total ?? 0} {offset} onchange={changePage} />
<Sheet open={selected !== null} {title} onclose={close} {reduced}>
  {#if selected}
    <form class="admin-action-form" onsubmit={submit}>
      <p class="admin-confirm-name">{selected.username}</p>
      <p class="admin-muted">
        {action === 'password'
          ? '设置 8–14 个字符的新密码，保存后撤销其全部登录会话。'
          : action === 'revoke'
            ? '撤销全部登录会话，用户需要重新登录。'
            : selected.disabled
              ? '恢复登录权限，旧会话仍然失效。'
              : '立即撤销全部登录会话，并禁止再次登录。'}
      </p>
      {#if action === 'password'}<label class="admin-field"
          >新密码<input
            type="password"
            bind:value={password}
            autocomplete="new-password"
            disabled={busy}
            required
          /></label
        >{/if}
      {#if error}<p class="admin-error" role="alert">{error}</p>{/if}
      <div class="admin-form-actions">
        <button
          class="admin-button"
          type="button"
          onclick={close}
          disabled={busy}>取消</button
        ><button
          class="admin-button primary"
          type="submit"
          disabled={busy || (action === 'password' && !validPassword)}
          >{busy ? '保存中…' : title}</button
        >
      </div>
    </form>
  {/if}
</Sheet>
