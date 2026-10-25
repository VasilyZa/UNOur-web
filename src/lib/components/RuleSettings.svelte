<script lang="ts">
  import { defaultRuleOptions, type RoomRuleOptions } from '../game/rules'

  let {
    options = $bindable(defaultRuleOptions()),
    busy,
  }: { options?: RoomRuleOptions; busy: boolean } = $props()
  type Toggle = { key: keyof RoomRuleOptions; title: string; detail: string }
  const matching: Toggle[] = [
    {
      key: 'sameColor',
      title: '允许同色接牌',
      detail: '可以接当前出牌颜色的牌。',
    },
    {
      key: 'sameValue',
      title: '允许同数字接牌',
      detail: '动作牌按同类型匹配；万能牌后按指定颜色接牌。',
    },
  ]
  const actions: Toggle[] = [
    {
      key: 'playAnyAfterDraw',
      title: '摸牌后允许出任意手牌',
      detail: '仍需符合本局接牌规则，也可以选择跳过。',
    },
    {
      key: 'skipDraw',
      title: '允许禁后摸牌',
      detail: '被跳过的玩家额外摸一张牌。',
    },
    {
      key: 'keepColor',
      title: '允许转色后颜色不变',
      detail: '万能牌可以保留当前颜色；关闭时必须换色。',
    },
  ]
  const stacking: Toggle[] = [
    {
      key: 'mixedStacking',
      title: '允许 +2 / +4 混合叠加',
      detail: '+2 和 +4 可以互相叠加。',
    },
    {
      key: 'differentColorStacking',
      title: '允许异色 +2 叠加',
      detail: '接 +2 时不受当前颜色限制。',
    },
    {
      key: 'reverseStacking',
      title: '允许连续转向',
      detail: '用反转牌把罚牌转给上家，可继续接反转。',
    },
  ]
  let changed = $derived(
    Object.entries(defaultRuleOptions()).filter(
      ([key, value]) => options[key as keyof RoomRuleOptions] !== value,
    ).length,
  )
</script>

<details class="rule-settings">
  <summary
    ><strong>自定义规则</strong><span
      >{changed ? `${changed} 项调整` : '默认规则'}<i aria-hidden="true">⌄</i
      ></span
    ></summary
  >
  <div class="rule-fields">
    <fieldset disabled={busy}>
      <legend>出牌匹配 <span>至少开启一项</span></legend>
      {#each matching as item}
        <label class="rule-setting">
          <span><strong>{item.title}</strong><small>{item.detail}</small></span>
          <input
            type="checkbox"
            bind:checked={options[item.key]}
            disabled={options[item.key] &&
              (item.key === 'sameColor'
                ? !options.sameValue
                : !options.sameColor)}
          />
        </label>
      {/each}
    </fieldset>
    <fieldset disabled={busy}>
      <legend>摸牌与动作牌</legend>
      {#each actions as item}
        <label class="rule-setting">
          <span><strong>{item.title}</strong><small>{item.detail}</small></span>
          <input type="checkbox" bind:checked={options[item.key]} />
        </label>
      {/each}
    </fieldset>
    <fieldset disabled={busy}>
      <legend>罚牌叠加</legend>
      <label class="rule-setting">
        <span
          ><strong>允许罚牌叠加</strong><small
            >开启后，可用同类罚牌继续接牌。</small
          ></span
        >
        <input type="checkbox" bind:checked={options.stacking} />
      </label>
      <fieldset class="dependent" disabled={!options.stacking}>
        <legend class="sr-only">叠加选项，需开启罚牌叠加</legend>
        {#each stacking as item}
          <label class="rule-setting">
            <span
              ><strong>{item.title}</strong><small>{item.detail}</small></span
            >
            <input type="checkbox" bind:checked={options[item.key]} />
          </label>
        {/each}
      </fieldset>
    </fieldset>
    <fieldset disabled={busy}>
      <legend>+4 质疑</legend>
      <label class="rule-setting">
        <span
          ><strong>允许 +4 质疑</strong><small
            >可质疑持有当前颜色时打出的 +4。</small
          ></span
        >
        <input type="checkbox" bind:checked={options.challenge} />
      </label>
      <label class="rule-setting">
        <span
          ><strong>质疑失败罚牌 2 倍</strong><small
            >{options.challenge
              ? '关闭时，承担当前罚牌池的 1.5 倍。'
              : '开启 +4 质疑后可设置。'}</small
          ></span
        >
        <input
          type="checkbox"
          bind:checked={options.doubleChallengePenalty}
          disabled={!options.challenge}
        />
      </label>
    </fieldset>
  </div>
</details>

<style>
  .rule-settings {
    margin: 12px 0 22px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface-muted);
  }
  summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 13px 14px;
    list-style: none;
    cursor: pointer;
    touch-action: manipulation;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary strong {
    font-size: 12px;
    font-weight: 550;
  }
  summary > span {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--muted);
    font-size: 10px;
  }
  summary i {
    font-size: 17px;
    font-style: normal;
  }
  details[open] summary i {
    transform: rotate(180deg);
  }
  .rule-fields {
    padding: 0 14px 7px;
    border-top: 1px solid var(--line);
  }
  fieldset {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .rule-fields > fieldset {
    padding-top: 18px;
  }
  legend {
    width: 100%;
    padding: 0 0 6px;
    color: var(--text);
    font-size: 11px;
    font-weight: 650;
  }
  legend > span {
    margin-left: 5px;
    color: var(--muted);
    font-size: 10px;
    font-weight: 400;
  }
  .rule-setting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 64px;
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
    cursor: pointer;
    touch-action: manipulation;
  }
  .rule-setting > span {
    min-width: 0;
  }
  .rule-setting strong {
    font-size: 12px;
    font-weight: 500;
    line-height: 1.5;
  }
  .rule-setting small {
    display: block;
    margin-top: 4px;
    color: var(--muted);
    font-size: 11px;
    line-height: 1.7;
  }
  .rule-setting input {
    flex: 0 0 21px;
    width: 21px;
    height: 21px;
    margin: 0;
    accent-color: var(--accent);
  }
  .rule-setting:has(input:disabled) {
    cursor: default;
  }
  .dependent:disabled,
  fieldset:disabled {
    opacity: 0.55;
  }
  .rule-fields > fieldset:last-child > .rule-setting:last-child {
    border-bottom: 0;
  }
</style>
