<script lang="ts">
  import Icon from './Icon.svelte'
  import { validateCredentials } from '../account/validation'
  import { errorMessage } from '../http'
  let {
    onauthenticate,
  }: {
    onauthenticate: (
      username: string,
      password: string,
      register: boolean,
    ) => Promise<void>
  } = $props()
  let register = $state(false),
    username = $state(''),
    password = $state(''),
    confirmation = $state(''),
    busy = $state(false),
    error = $state('')
  async function submit(event: SubmitEvent) {
    event.preventDefault()
    if (busy) return
    error = validateCredentials(username, password, register)
    if (!error && register && password !== confirmation)
      error = '两次输入的密码不一致。'
    if (error) return
    busy = true
    try {
      await onauthenticate(username, password, register)
      password = ''
      confirmation = ''
    } catch (reason) {
      error = errorMessage(reason)
    } finally {
      busy = false
    }
  }
</script>

<div class="entry-heading">
  <span class="entry-icon"><Icon name="user" size={24} /></span>
  <h1>{register ? '创建账户' : '登录'}</h1>
</div>
<div class="segmented" role="group" aria-label="账户操作">
  <button
    class:chosen={!register}
    aria-pressed={!register}
    disabled={busy}
    onclick={() => {
      register = false
      error = ''
      password = ''
      confirmation = ''
    }}>登录</button
  >
  <button
    class:chosen={register}
    aria-pressed={register}
    disabled={busy}
    onclick={() => {
      register = true
      error = ''
      password = ''
      confirmation = ''
    }}>注册</button
  >
</div>
<form onsubmit={submit} aria-busy={busy}>
  <label class="field"
    ><span>用户名</span><input
      bind:value={username}
      autocomplete="username"
      autocapitalize="none"
      spellcheck="false"
      maxlength="48"
      placeholder="输入用户名"
      required
      disabled={busy}
      enterkeyhint="next"
    /></label
  >
  <label class="field"
    ><span>密码</span><input
      bind:value={password}
      type="password"
      autocomplete={register ? 'new-password' : 'current-password'}
      maxlength="28"
      placeholder={register ? '8–14 个字符' : '输入密码'}
      required
      disabled={busy}
      enterkeyhint={register ? 'next' : 'go'}
    /></label
  >
  {#if register}<label class="field"
      ><span>确认密码</span><input
        bind:value={confirmation}
        type="password"
        autocomplete="new-password"
        maxlength="28"
        placeholder="再次输入密码"
        required
        disabled={busy}
        enterkeyhint="go"
      /></label
    >{/if}
  {#if error}<p class="form-error" role="alert">{error}</p>{/if}
  <button class="button primary full" type="submit" disabled={busy}
    >{busy ? '正在确认…' : register ? '注册并登录' : '登录'}<Icon
      name="arrow"
      size={18}
    /></button
  >
  {#if register}<p class="form-tip">
      用户名 3–24 个字符，英文字母不区分大小写。
    </p>{/if}
</form>
