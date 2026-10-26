<script lang="ts">
  import Icon from './Icon.svelte'
  import RuleSettings from './RuleSettings.svelte'
  import type { RuleCatalog, RuleSelection } from '../game/rules'
  import type { BotDifficulty } from '../game/types'
  let {
    spectate = $bindable(false),
    code = $bindable(''),
    mode = $bindable('solo'),
    rules = $bindable({}),
    catalog,
    catalogLoading,
    catalogError,
    onReloadRules,
    botCount = $bindable(2),
    difficulty = $bindable<BotDifficulty>('normal'),
    busy,
    error,
    onsubmit,
  }: {
    spectate?: boolean
    code?: string
    mode?: 'create' | 'join' | 'solo'
    rules?: RuleSelection
    catalog: RuleCatalog | null
    catalogLoading: boolean
    catalogError: string
    onReloadRules: () => void
    botCount?: number
    difficulty?: BotDifficulty
    busy: boolean
    error: string
    onsubmit: (event: SubmitEvent) => void
  } = $props()
</script>

<form class="room-form" {onsubmit} aria-busy={busy}>
  <div class="room-setup">
    <div class="segmented room-modes" role="group" aria-label="对局方式">
      <button
        type="button"
        class:chosen={mode === 'solo'}
        aria-pressed={mode === 'solo'}
        disabled={busy}
        onclick={() => (mode = 'solo')}
        ><span>人机对战</span><span class="mode-check"
          ><Icon name="arrow" size={20} /></span
        ></button
      >
      <button
        type="button"
        class:chosen={mode === 'create'}
        aria-pressed={mode === 'create'}
        disabled={busy}
        onclick={() => (mode = 'create')}
        ><span>创建房间</span><span class="mode-check"
          ><Icon name="arrow" size={20} /></span
        ></button
      >
      <button
        type="button"
        class:chosen={mode === 'join'}
        aria-pressed={mode === 'join'}
        disabled={busy}
        onclick={() => (mode = 'join')}
        ><span>加入房间</span><span class="mode-check"
          ><Icon name="arrow" size={20} /></span
        ></button
      >
    </div>
    {#if mode === 'solo'}
      <section class="solo-settings" aria-label="人机对局设置">
        <h2 class="setup-heading">对局设置</h2>
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
      </section>
    {/if}
    <div class="room-submit">
      {#if error}<p class="form-error" role="alert">{error}</p>{/if}
      <button
        class="button primary full"
        type="submit"
        disabled={busy ||
          (mode !== 'join' && (!catalog || catalogLoading || !!catalogError))}
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
    </div>
  </div>
  {#if mode === 'join'}
    <section class="join-panel" aria-label="加入设置">
      <h2 class="setup-heading">加入房间</h2>
      <div class="join-fields">
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
      </div>
    </section>
  {:else}
    <div class="room-rules">
      {#if catalog}<RuleSettings
          {catalog}
          bind:options={rules}
          busy={busy || catalogLoading}
        />{/if}
      {#if catalogLoading}<p class="rules-status" role="status">
          正在读取规则…
        </p>
      {:else if catalogError}<div class="rules-status" role="alert">
          <p>{catalogError}</p>
          <button
            class="text-button"
            type="button"
            onclick={onReloadRules}
            disabled={busy}>重新读取规则</button
          >
        </div>
      {/if}
    </div>
  {/if}
</form>

<style>
  .room-form {
    display: flex;
    flex-direction: column;
  }
  .room-setup {
    display: contents;
  }
  .room-modes {
    order: 0;
    gap: 2px;
    margin-bottom: 20px;
  }
  .room-modes button {
    min-width: 0;
    padding: 0 5px;
    font-size: 11px;
    white-space: nowrap;
  }
  .mode-check,
  .setup-heading {
    display: none;
  }
  .solo-settings {
    order: 1;
  }
  .solo-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 13px;
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
  .room-rules,
  .join-panel {
    order: 2;
    min-width: 0;
  }
  .room-submit {
    order: 3;
  }
  .room-submit > button {
    width: 100%;
  }
  .rules-status {
    margin: 16px 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.7;
  }
  .rules-status p {
    margin: 0 0 8px;
  }
  @media (min-width: 700px) {
    .room-form {
      display: grid;
      grid-template-columns: 208px minmax(0, 1fr);
      align-items: start;
      gap: 40px;
    }
    .room-setup {
      position: sticky;
      top: 28px;
      display: flex;
      flex-direction: column;
      padding: 0;
    }
    .room-modes {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
    }
    .room-modes button {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 16px;
      flex: none;
      width: 100%;
      min-height: 68px;
      padding: 12px 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      font-size: 22px;
      font-weight: 450;
      color: var(--faint);
      text-align: left;
      box-shadow: none;
      transition:
        transform 120ms var(--ease-out),
        color 160ms ease;
    }
    .room-modes button.chosen {
      color: var(--text);
      background: transparent;
      font-weight: 650;
      box-shadow: none;
    }
    .mode-check {
      display: inline-flex;
      flex-shrink: 0;
      margin-left: auto;
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .chosen .mode-check {
      opacity: 1;
    }
    .room-modes button:active:not(:disabled) {
      transform: translateX(3px);
    }
    .solo-settings {
      margin: 36px 0 0;
      padding-top: 28px;
      border-top: 1px solid var(--line);
    }
    .setup-heading {
      display: block;
      margin: 0 0 20px;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.4;
      letter-spacing: -0.02em;
    }
    .solo-options {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin: 0;
    }
    .solo-field {
      gap: 10px;
      color: var(--muted);
      font-size: 13px;
    }
    .solo-field select {
      min-height: 48px;
      padding: 0 14px;
      border-radius: 8px;
      background: var(--surface);
      color: var(--text);
    }
    .room-submit {
      margin: 40px 0 0;
    }
    .room-submit > button {
      min-height: 50px;
      padding: 0 12px;
      border-radius: 8px;
      font-size: 13px;
      gap: 8px;
    }
    .room-submit .form-tip {
      margin: 14px 0 4px;
      font-size: 11px;
      line-height: 1.8;
      text-align: left;
    }
    .join-panel {
      min-height: 380px;
      padding: 8px 0 32px;
    }
    .join-panel > h2 {
      margin-bottom: 36px;
      font-size: 22px;
    }
    .join-fields {
      max-width: 440px;
    }
    .join-fields :global(.field > span) {
      font-size: 14px;
      margin-bottom: 12px;
    }
    .join-fields :global(.field input) {
      min-height: 54px;
    }
    .join-fields :global(.rule-toggle) {
      gap: 20px;
      margin: 28px 0 0;
      padding: 24px 0;
    }
    .join-fields :global(.rule-toggle strong) {
      font-size: 14px;
    }
    .join-fields :global(.rule-toggle span) {
      font-size: 12px;
    }
    .rules-status {
      padding: 24px 0;
      margin: 0;
      font-size: 14px;
    }
  }
  @media (min-width: 1100px) {
    .room-form {
      grid-template-columns: 260px minmax(0, 1fr);
      gap: clamp(48px, 6vw, 88px);
    }
    .room-modes button {
      min-height: 76px;
      font-size: 26px;
    }
  }
  @media (min-width: 700px) and (max-height: 699px) {
    .room-setup {
      position: static;
    }
  }
  @media (hover: hover) and (pointer: fine) and (min-width: 700px) {
    .room-modes button:hover:not(:disabled):not(.chosen) {
      color: var(--text);
      background: transparent;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .room-modes button:active:not(:disabled) {
      transform: none;
    }
  }
  :global(.gentle) .room-modes button:active:not(:disabled) {
    transform: none;
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
