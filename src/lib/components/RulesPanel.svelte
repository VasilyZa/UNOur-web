<script lang="ts">
  import Icon from './Icon.svelte'
  import type { Room } from '../game/types'
  let { room, onclose }: { room: Room; onclose: () => void } = $props()
  let details = $derived(room.rule_descriptions ?? [])
</script>

<div class="rule-intro">
  <span class="rule-intro-icon"><Icon name="cards" size={25} /></span>
  <div>
    <strong>本局配置</strong>
    <p>2–10 人 · 出完手牌后结算胜负</p>
  </div>
</div>
<ol class="rules-list">
  {#each details as item, index}
    <li>
      <span>{String(index + 1).padStart(2, '0')}</span>
      <div>
        <strong>{item.title}</strong>
        {#each item.text as text}<p>{text}</p>{/each}
      </div>
    </li>
  {/each}
</ol>
<p class="uno-note">
  只剩一张时，两秒内点中央 UNO 按钮或按空格键；漏喊罚摸一张。
</p>
<div class="rule-note">
  <Icon name="shield" size={17} />
  <p>本局规则由房主创建时确定；出牌结果以服务器判定为准。</p>
</div>
<button class="button primary full" onclick={onclose}
  >返回牌桌<Icon name="arrow" size={17} /></button
>

<style>
  .uno-note {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.8;
    margin: 0 0 16px;
  }
</style>
