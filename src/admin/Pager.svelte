<script lang="ts">
  let {
    total,
    offset,
    onchange,
  }: { total: number; offset: number; onchange: (offset: number) => void } =
    $props()
</script>

{#if total > 20 || offset > 0}
  <nav class="admin-pager" aria-label="分页">
    <button
      class="admin-button"
      disabled={offset === 0}
      onclick={() => onchange(Math.max(0, offset - 20))}>上一页</button
    >
    <span
      >{total ? offset + 1 : 0}–{Math.min(offset + 20, total)} / {total}</span
    >
    <button
      class="admin-button"
      disabled={offset + 20 >= total}
      onclick={() => onchange(offset + 20)}>下一页</button
    >
  </nav>
{/if}
