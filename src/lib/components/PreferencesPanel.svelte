<script lang="ts">
  import Icon from './Icon.svelte'
  import type { ThemePreference } from '../theme'
  let {
    quietMotion = $bindable(false),
    systemReduced,
    themePreference = $bindable('system'),
  }: {
    quietMotion?: boolean
    systemReduced: boolean
    themePreference?: ThemePreference
  } = $props()
</script>

<fieldset class="theme-picker">
  <legend>外观</legend>
  <div class="theme-options">
    {#each [{ value: 'system', label: '跟随系统', icon: 'monitor' }, { value: 'light', label: '浅色', icon: 'sun' }, { value: 'dark', label: '深色', icon: 'moon' }] as option}
      <label
        ><input
          type="radio"
          name="theme"
          value={option.value}
          bind:group={themePreference}
        /><Icon name={option.icon} size={18} /><span>{option.label}</span
        ></label
      >
    {/each}
  </div>
</fieldset>

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
    <p>当前为静音模式</p>
  </div>
  <span class="small-badge">静音</span>
</div>
<p class="settings-footer">
  UNOur · <a href="/fonts/misans/LICENSE.pdf" target="_blank" rel="noreferrer"
    >使用 MiSans 字体</a
  >
</p>
