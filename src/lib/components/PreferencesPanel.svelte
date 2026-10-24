<script lang="ts">
  import Icon from './Icon.svelte'
  let {
    quietMotion = $bindable(false),
    systemReduced,
    mode,
    resetDemo,
    resumable,
    onresume,
  }: {
    quietMotion?: boolean
    systemReduced: boolean
    mode: 'demo' | 'online'
    resetDemo: (scenario?: 'normal' | 'uno') => void
    resumable: boolean
    onresume: () => void
  } = $props()
</script>

<div class="setting-row">
  <div>
    <strong>轻柔动效</strong>
    <p>
      {systemReduced ? '已跟随系统减少动态效果' : '减少牌的位移，保留轻柔反馈'}
    </p>
  </div>
  <label class="switch"
    ><input
      type="checkbox"
      bind:checked={quietMotion}
      aria-label="轻柔动效"
      disabled={systemReduced}
    /><span></span></label
  >
</div>
<div class="setting-row">
  <div>
    <strong>牌桌声音</strong>
    <p>初版保持安静，听见身边的朋友</p>
  </div>
  <span class="small-badge">静音</span>
</div>
<div class="setting-group">
  <span class="eyebrow">TRY SOMETHING</span><button
    class="setting-link"
    onclick={() => resetDemo('uno')}
    ><span
      ><Icon name="clock" size={19} /><span
        >体验两秒喊 UNO<small>两张手牌，试试看你的反应</small></span
      ></span
    ><Icon name="chevron" size={17} /></button
  ><button class="setting-link" onclick={() => resetDemo()}
    ><span
      ><Icon name="reset" size={19} /><span
        >{mode === 'demo' ? '重新开始试玩' : '离开联机，回到试玩'}<small
          >{mode === 'demo'
            ? '重置这张牌桌，换个好手气'
            : '保留入座凭证，随时可以回来'}</small
        ></span
      ></span
    ><Icon name="chevron" size={17} /></button
  >{#if resumable && mode === 'demo'}<button
      class="setting-link"
      onclick={onresume}
      ><span
        ><Icon name="link" size={19} /><span
          >回到上次联机牌桌<small>使用保存的座位，继续和朋友一起玩</small></span
        ></span
      ><Icon name="chevron" size={17} /></button
    >{/if}
</div>
<p class="settings-footer">UNOur · 好朋友，来一局。</p>
