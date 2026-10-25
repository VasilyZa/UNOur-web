<script lang="ts">
  import { onMount } from 'svelte'
  import { ApiError, errorMessage } from '../lib/http'
  import {
    applyTheme,
    readTheme,
    saveTheme,
    type ThemePreference,
  } from '../lib/theme'
  import { AdminClient } from './api'
  import type { AdminSession } from './types'
  import RoomsView from './RoomsView.svelte'
  import UsersView from './UsersView.svelte'
  import AuditView from './AuditView.svelte'
  import './admin.css'

  const client = new AdminClient()
  let session = $state<AdminSession | null>(null)
  let checking = $state(true)
  let password = $state('')
  let busy = $state(false)
  let disabled = $state(false)
  let error = $state('')
  let tab = $state<'rooms' | 'users' | 'audit'>('rooms')
  let theme = $state<ThemePreference>(readTheme())
  function changeTheme() {
    saveTheme(theme)
    applyTheme(theme, matchMedia('(prefers-color-scheme: dark)').matches)
  }
  function failure(value: unknown) {
    if (value instanceof ApiError && value.status === 401) {
      session = null
      error = '管理会话已过期，请重新登录。'
    }
  }
  onMount(() => {
    const abort = new AbortController()
    const media = matchMedia('(prefers-color-scheme: dark)')
    const sync = () => applyTheme(theme, media.matches)
    sync()
    media.addEventListener('change', sync)
    void client
      .current(abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) session = value
      })
      .catch((value) => {
        if (abort.signal.aborted) return
        if (value instanceof ApiError && value.status === 404) disabled = true
        else if (!(value instanceof ApiError && value.status === 401))
          error = errorMessage(value)
      })
      .finally(() => {
        if (!abort.signal.aborted) checking = false
      })
    return () => {
      abort.abort()
      media.removeEventListener('change', sync)
    }
  })
  async function login(event: SubmitEvent) {
    event.preventDefault()
    if (busy) return
    busy = true
    error = ''
    try {
      session = await client.login(password)
    } catch (value) {
      error = errorMessage(value)
    } finally {
      busy = false
      password = ''
    }
  }
  async function logout() {
    if (busy) return
    busy = true
    try {
      await client.logout()
      session = null
      error = ''
    } catch (value) {
      failure(value)
      error = errorMessage(value)
    } finally {
      busy = false
    }
  }
</script>

<svelte:head>
  <title>UNOur · 管理</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<main class="admin-shell">
  <header class="admin-header">
    <a class="admin-brand" href="/" aria-label="返回游戏">UNOur<span>.</span></a
    >
    <span class="admin-label">管理</span>
    <div class="admin-header-actions">
      <label class="admin-theme"
        ><span class="sr-only">外观</span>
        <select aria-label="外观" bind:value={theme} onchange={changeTheme}>
          <option value="system">跟随系统</option><option value="light"
            >浅色</option
          ><option value="dark">深色</option>
        </select>
      </label>
      {#if session}<button
          class="admin-button subtle"
          disabled={busy}
          onclick={logout}>退出</button
        >{/if}
    </div>
  </header>
  {#if checking}
    <div class="admin-placeholder" role="status">正在检查登录状态…</div>
  {:else if !session}
    <section class="admin-login admin-panel">
      <div class="admin-lock" aria-hidden="true">⌑</div>
      <h1>管理登录</h1>
      {#if disabled}<p class="admin-notice">
          管理后台尚未启用，请先配置服务端。
        </p>{/if}
      <form onsubmit={login}>
        <label class="admin-field"
          >管理密码
          <input
            type="password"
            bind:value={password}
            autocomplete="current-password"
            required
            disabled={busy || disabled}
            spellcheck="false"
          />
        </label>
        {#if error}<p class="admin-error" role="alert">{error}</p>{/if}
        <button
          class="admin-button primary"
          disabled={busy || disabled || !password}
          type="submit">{busy ? '登录中…' : '登录'}</button
        >
      </form>
    </section>
  {:else}
    <nav class="admin-tabs" aria-label="管理分区">
      <button
        aria-pressed={tab === 'rooms'}
        onclick={() => {
          tab = 'rooms'
        }}>实时房间</button
      >
      <button
        aria-pressed={tab === 'users'}
        onclick={() => {
          tab = 'users'
        }}>用户</button
      >
      <button
        aria-pressed={tab === 'audit'}
        onclick={() => {
          tab = 'audit'
        }}>操作记录</button
      >
    </nav>
    <div class="admin-content">
      {#if tab === 'rooms'}<RoomsView {client} onerror={failure} />
      {:else if tab === 'users'}<UsersView {client} onerror={failure} />
      {:else}<AuditView {client} onerror={failure} />{/if}
    </div>
  {/if}
</main>
