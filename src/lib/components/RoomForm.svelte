<script lang="ts">
  import Icon from './Icon.svelte'
  import type { BotDifficulty } from '../game/types'
  let {
    spectate = $bindable(false),
    code = $bindable(''),
    mode = $bindable('solo'),
    stacking = $bindable(false),
    botCount = $bindable(2),
    difficulty = $bindable<BotDifficulty>('normal'),
    busy,
    error,
    onsubmit,
  }: {
    spectate?: boolean
    code?: string
    mode?: 'create' | 'join' | 'solo'
    stacking?: boolean
    botCount?: number
    difficulty?: BotDifficulty
    busy: boolean
    error: string
    onsubmit: (event: SubmitEvent) => void
  } = $props()
</script>

<div class="segmented room-modes" role="group" aria-label="对局方式">
  <button
    class:chosen={mode === 'solo'}
    aria-pressed={mode === 'solo'}
    disabled={busy}
    onclick={() => (mode = 'solo')}>人机对战</button
  ><button
    class:chosen={mode === 'create'}
    aria-pressed={mode === 'create'}
    disabled={busy}
    onclick={() => (mode = 'create')}>创建房间</button
  ><button
    class:chosen={mode === 'join'}
    aria-pressed={mode === 'join'}
    disabled={busy}
    onclick={() => (mode = 'join')}>加入房间</button
  >
</div>
<form {onsubmit} aria-busy={busy}>
  {#if mode === 'join'}
    <label class="field">
      <span>房间号</span><input
        bind:value={code}
        placeholder="输入或粘贴房间号"
        maxlength="64"
        autocapitalize="none"
        autocomplete="off"
        spellcheck="false"
        enterkeyhint="go"
        required
        disabled={busy}
      />
    </label>
    <label class="rule-toggle">
      <div>
        <strong>仅观战</strong><span>不占座位，不参与再来一局投票</span>
      </div>
      <input type="checkbox" bind:checked={spectate} disabled={busy} />
    </label>
  {:else}
    {#if mode === 'solo'}
      <div class="solo-options">
        <label class="solo-field">
          <span>电脑数量</span>
          <select bind:value={botCount} disabled={busy}>
            {#each Array.from({ length: 9 }, (_, index) => index + 1) as count}
              <option value={count}>{count} 名</option>
            {/each}
          </select>
        </label>
        <label class="solo-field">
          <span>对手难度</span>
          <select bind:value={difficulty} disabled={busy}>
            <option value="easy">简单</option>
            <option value="normal">标准</option>
            <option value="hard">困难</option>
            <option value="expert">专家</option>
          </select>
        </label>
      </div>
      <p class="solo-tip">根据出牌记录与局势思考。</p>
    {/if}
    <label class="rule-toggle">
      <div>
        <strong>允许罚牌叠加</strong><span>允许在 +2 上继续出 +2</span>
      </div>
      <input type="checkbox" bind:checked={stacking} disabled={busy} />
    </label>
  {/if}
  {#if error}<p class="form-error" role="alert">{error}</p>{/if}
  <button class="button primary full" type="submit" disabled={busy}
    >{busy
      ? '正在进入…'
      : mode === 'join'
        ? spectate
          ? '进入观战'
          : '加入房间'
        : mode === 'create'
          ? '创建房间'
          : '开始人机对战'}<Icon name="arrow" size={18} /></button
  >
  <p class="form-tip">
    {mode === 'join'
      ? '牌局已开始时，加入者先观战，下一局入座。'
      : mode === 'create'
        ? '创建后可复制房间号或邀请链接。'
        : `你与 ${botCount} 名电脑玩家开始对局。`}
  </p>
</form>

<style>
  .room-modes {
    gap: 2px;
    margin-bottom: 20px;
  }
  .room-modes button {
    min-width: 0;
    padding: 0 5px;
    font-size: 11px;
    white-space: nowrap;
  }
  .solo-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 10px;
  }
  .solo-field {
    display: grid;
    gap: 8px;
    min-width: 0;
    font-size: 12px;
  }
  .solo-field select {
    width: 100%;
    height: 46px;
    padding: 0 11px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface-muted);
    color: var(--text);
    font: inherit;
    font-size: 16px;
  }
  .solo-field select:disabled {
    opacity: 0.6;
  }
  .solo-tip {
    color: var(--muted);
    font-size: 10px;
    line-height: 1.7;
    margin: 1px 0 13px;
  }
  @media (max-width: 359px) {
    .room-modes button {
      min-height: 42px;
      padding: 0 2px;
      font-size: 10px;
    }
    .solo-options {
      gap: 8px;
    }
  }
</style>
