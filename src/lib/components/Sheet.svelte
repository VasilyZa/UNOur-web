<script lang="ts">
  import { onDestroy, type Snippet } from 'svelte'
  import Icon from './Icon.svelte'
  let {
    open,
    title,
    description = '',
    onclose,
    children,
    reduced = false,
  }: {
    open: boolean
    title: string
    description?: string
    onclose: () => void
    children: Snippet
    reduced?: boolean
  } = $props()
  let dialog: HTMLDialogElement
  let motion: Animation | undefined
  let closing = $state(false)

  $effect(() => {
    if (!dialog) return
    const visible = open
    const gentle =
      reduced || matchMedia('(prefers-reduced-motion: reduce)').matches
    motion?.cancel()
    if (visible) {
      closing = false
      if (!dialog.open) {
        dialog.showModal()
        motion = dialog.animate(
          [
            {
              opacity: 0,
              transform: gentle ? 'none' : 'translateY(16px) scale(.97)',
            },
            { opacity: 1, transform: 'none' },
          ],
          {
            duration: gentle ? 160 : 250,
            easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
          },
        )
      }
    } else if (dialog.open) {
      closing = true
      motion = dialog.animate(
        [
          { opacity: 1, transform: 'none' },
          {
            opacity: 0,
            transform: gentle ? 'none' : 'translateY(16px) scale(.97)',
          },
        ],
        {
          duration: gentle ? 120 : 200,
          easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
          fill: 'forwards',
        },
      )
      motion.finished
        .then(() => {
          if (!open) dialog.close()
        })
        .catch(() => {})
    }
  })
  onDestroy(() => {
    motion?.cancel()
    dialog?.close()
  })

  function backdrop(event: MouseEvent) {
    if (event.target !== dialog) return
    const rect = dialog.getBoundingClientRect()
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      onclose()
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialog}
  class:closing
  class="sheet"
  aria-labelledby="sheet-title"
  aria-describedby={description ? 'sheet-description' : undefined}
  onclick={backdrop}
  oncancel={(event) => {
    event.preventDefault()
    onclose()
  }}
>
  <div class="sheet-grip" aria-hidden="true"></div>
  <header class="sheet-header">
    <div>
      <h2 id="sheet-title">{title}</h2>
      {#if description}<p id="sheet-description">{description}</p>{/if}
    </div>
    <button class="icon-button" aria-label="关闭面板" onclick={onclose}
      ><Icon name="close" /></button
    >
  </header>
  <div class="sheet-body">{@render children()}</div>
</dialog>

<style>
  .sheet {
    width: min(460px, calc(100% - 32px));
    max-height: calc(100dvh - 48px);
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 25px;
    background: #242b25;
    color: var(--text);
    overflow: visible;
    box-shadow: 0 30px 100px #0006;
  }
  .sheet::backdrop {
    background: #0a100ebd;
    backdrop-filter: blur(5px);
    opacity: 1;
    transition: opacity 200ms var(--ease-out);
  }
  .sheet.closing::backdrop {
    opacity: 0;
  }
  .sheet-grip {
    display: none;
  }
  .sheet-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding: 28px 24px 16px;
  }
  h2 {
    margin: 0;
    font-size: 21px;
    letter-spacing: -0.5px;
  }
  p {
    margin: 9px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: var(--muted);
  }
  .sheet-body {
    padding: 4px 24px 28px;
    max-height: calc(100dvh - 210px);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  @media (max-width: 599px) {
    .sheet {
      width: 100%;
      max-width: none;
      max-height: calc(100dvh - 24px - env(safe-area-inset-top, 0px));
      margin: auto 0 0;
      border-radius: 26px 26px 0 0;
      border-bottom: 0;
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    .sheet-grip {
      display: block;
      width: 32px;
      height: 4px;
      border-radius: 4px;
      background: #627064;
      margin: 10px auto 0;
    }
    .sheet-header {
      padding-top: 16px;
    }
  }
</style>
