<script lang="ts">
  import { avatarURL } from '../http'
  let { src = '', size = 40 }: { src?: string; size?: number | '100%' } =
    $props()
  const dimension = $derived(typeof size === 'number' ? `${size}px` : size)
  let failed = $state(false)
  const image = $derived(avatarURL(src))
  $effect(() => {
    src
    failed = false
  })
</script>

<span
  class="avatar-image"
  style:width={dimension}
  style:height={dimension}
  aria-hidden="true"
>
  {#if image && !failed}
    <img
      src={image}
      alt=""
      decoding="async"
      onerror={() => {
        failed = true
      }}
    />
  {:else}
    <svg viewBox="0 0 64 64" fill="none"
      ><circle cx="32" cy="32" r="32" fill="var(--avatar-background)" /><circle
        cx="32"
        cy="25"
        r="10"
        fill="var(--avatar-foreground)"
      /><path
        d="M13 57a19 19 0 0 1 38 0"
        fill="var(--avatar-foreground)"
      /></svg
    >
  {/if}
</span>

<style>
  .avatar-image {
    display: inline-flex;
    flex: 0 0 auto;
    border-radius: 50%;
    overflow: hidden;
    vertical-align: middle;
    background: var(--avatar-background);
  }
  svg,
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
