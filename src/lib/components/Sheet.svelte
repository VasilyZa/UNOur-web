<script lang="ts">
  import { onDestroy, type Snippet } from 'svelte'
  import Icon from './Icon.svelte'
  import { DialogMotion } from '../motion/dialog'
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
  let motion: DialogMotion | undefined
  let closing = $state(false)
  let pressedOutside = false
  const id = $props.id()

  $effect.pre(() => {
    if (!dialog) return
    if (!open && dialog.open) dialog.style.height = `${dialog.offsetHeight}px`
    else if (open) dialog.style.removeProperty('height')
  })
  $effect(() => {
    if (!dialog) return
    motion ??= new DialogMotion(dialog)
    closing = !open && dialog.open
    motion.transition(open, reduced)
  })
  onDestroy(() => motion?.dispose())

  function outside(event: MouseEvent | PointerEvent) {
    const rect = dialog.getBoundingClientRect()
    return (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    )
  }

  function backdrop(event: MouseEvent) {
    if (pressedOutside && outside(event)) onclose()
    pressedOutside = false
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialog}
  class:closing
  class="sheet"
  aria-labelledby={`${id}-title`}
  aria-describedby={description ? `${id}-description` : undefined}
  onpointerdown={(event) => {
    pressedOutside = outside(event)
  }}
  onpointercancel={() => {
    pressedOutside = false
  }}
  onclick={backdrop}
  oncancel={(event) => {
    event.preventDefault()
    onclose()
  }}
>
  <div class="sheet-grip" aria-hidden="true"></div>
  <header class="sheet-header">
    <div>
      <h2 id={`${id}-title`}>{title}</h2>
      {#if description}<p id={`${id}-description`}>{description}</p>{/if}
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
    background: var(--surface-raised);
    color: var(--text);
    overflow: hidden;
    box-shadow: 0 30px 100px var(--shadow-strong);
  }
  .sheet[open] {
    display: flex;
    flex-direction: column;
  }
  .sheet::backdrop {
    background: var(--backdrop);
    backdrop-filter: blur(5px);
    opacity: 1;
    transition: opacity 200ms var(--ease-out);
  }
  .sheet.closing::backdrop {
    opacity: 0;
  }
  .sheet-grip {
    display: none;
    flex: 0 0 auto;
  }
  .sheet-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex: 0 0 auto;
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
    flex: 1 1 auto;
    min-height: 0;
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
      background: var(--line-strong);
      margin: 10px auto 0;
    }
    .sheet-header {
      padding-top: 16px;
    }
  }
</style>
