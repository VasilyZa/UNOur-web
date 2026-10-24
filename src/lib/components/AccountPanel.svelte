<script lang="ts">
  import Avatar from './Avatar.svelte'
  import Icon from './Icon.svelte'
  import type { Account } from '../account/api'
  let {
    user,
    busy,
    error,
    onupload,
    onreset,
    onlogout,
  }: {
    user: Account
    busy: boolean
    error: string
    onupload: (file: File) => void
    onreset: () => void
    onlogout: () => void
  } = $props()
</script>

<div class="account-profile">
  <Avatar src={user.avatar_url} size={88} />
  <h3>{user.username}</h3>
</div>
<label class="button secondary full upload-button" class:disabled={busy}>
  <Icon name="upload" size={18} />{busy ? '正在处理…' : '上传头像'}
  <input
    class="sr-only"
    type="file"
    accept="image/png,image/jpeg"
    aria-label="上传头像"
    disabled={busy}
    onchange={(event) => {
      const file = event.currentTarget.files?.[0]
      if (file) onupload(file)
      event.currentTarget.value = ''
    }}
  />
</label>
<p class="form-tip">PNG 或 JPEG，最多 2 MiB，图片将居中裁切。</p>
{#if user.avatar_url}<button
    class="text-button reset-avatar"
    disabled={busy}
    onclick={onreset}>恢复默认头像</button
  >{/if}
{#if error}<p class="form-error" role="alert">{error}</p>{/if}
<div class="account-separator"></div>
<button class="button secondary full" disabled={busy} onclick={onlogout}
  ><Icon name="exit" size={17} />退出登录</button
>
