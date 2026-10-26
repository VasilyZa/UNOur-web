<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity'
  import Icon from './Icon.svelte'
  import {
    createRuleSelection,
    effectiveRuleOptions,
    isLastRequiredChoice,
    optionAvailable,
    type RuleCatalog,
    type RuleSelection,
  } from '../game/rules'
  import type { RuleScalar } from '../game/types'
  let {
    catalog,
    options = $bindable({}),
    busy,
  }: {
    catalog: RuleCatalog
    options?: RuleSelection
    busy: boolean
  } = $props()
  const wide = new MediaQuery('min-width: 700px')
  const id = $props.id()
  let expanded = $state(false)
  let group = $state('')
  let groups = $derived([
    ...new Set(catalog.modules.map((module) => module.group || '其他规则')),
  ])
  let activeGroup = $derived(groups.includes(group) ? group : groups[0])
  let modules = $derived(
    wide.current
      ? catalog.modules.filter(
          (module) => (module.group || '其他规则') === activeGroup,
        )
      : catalog.modules,
  )
  let changed = $derived(
    catalog.modules.reduce((count, module) => {
      const selected = options[module.name]
      if (!selected) return count
      const enabled = module.required || selected.enabled
      if (enabled !== module.default_enabled) count++
      if (enabled) {
        const values = effectiveRuleOptions(module, selected.options)
        count += module.options.filter(
          (option) => values[option.key] !== option.default,
        ).length
      }
      return count
    }, 0),
  )
  function update(module: string, key: string, value: RuleScalar) {
    options[module].options[key] = value
  }
</script>

<section class="rule-settings" aria-label="自定义规则">
  <header class="rules-heading">
    <div>
      <h2>自定义规则</h2>
      <span class="rule-count" role="status"
        >{changed ? `${changed} 项调整` : '默认规则'}</span
      >
    </div>
    <button
      class="restore-rules"
      type="button"
      disabled={busy || !changed}
      onclick={() => (options = createRuleSelection(catalog))}
      ><Icon name="reset" size={15} />恢复默认</button
    >
  </header>
  <button
    class="rule-toggle-button"
    type="button"
    aria-expanded={expanded}
    aria-controls={`${id}-fields`}
    onclick={() => (expanded = !expanded)}
    ><strong>自定义规则</strong><span
      >{changed ? `${changed} 项调整` : '默认规则'}<i aria-hidden="true">⌄</i
      ></span
    ></button
  >
  {#if wide.current && groups.length > 1}
    <div
      class="rule-groups"
      role="group"
      aria-label="规则分类"
      style:grid-template-columns={`repeat(${groups.length}, minmax(0, 1fr))`}
    >
      {#each groups as name}
        <button
          type="button"
          class:chosen={activeGroup === name}
          aria-pressed={activeGroup === name}
          onclick={() => (group = name)}>{name}</button
        >
      {/each}
      <span
        class="rule-group-line"
        aria-hidden="true"
        style:width={`${100 / groups.length}%`}
        style:transform={`translateX(${groups.indexOf(activeGroup) * 100}%)`}
      ></span>
    </div>
  {/if}
  <div
    class="rule-fields"
    id={`${id}-fields`}
    hidden={!wide.current && !expanded}
  >
    {#each modules as module (module.name)}
      {@const selected = options[module.name]}
      {#if selected}
        <fieldset disabled={busy}>
          <legend
            >{module.title}{#if module.group}<span>{module.group}</span
              >{/if}</legend
          >
          {#if module.description}<p class="module-description">
              {module.description}
            </p>{/if}
          {#if !module.required}
            <label class="rule-setting module-enable">
              <span><strong>启用{module.title}</strong></span>
              <input type="checkbox" bind:checked={selected.enabled} />
            </label>
          {/if}
          {#if module.required || selected.enabled}
            {#each module.options as option (option.key)}
              {@const unavailable = !optionAvailable(
                module,
                option,
                selected.options,
              )}
              <label class="rule-setting">
                <span
                  ><strong>{option.label}</strong>{#if option.description}<small
                      >{option.description}</small
                    >{/if}</span
                >
                {#if option.type === 'boolean'}
                  <input
                    type="checkbox"
                    checked={selected.options[option.key] === true}
                    disabled={unavailable ||
                      isLastRequiredChoice(
                        module,
                        option.key,
                        selected.options,
                      )}
                    onchange={(event) =>
                      update(
                        module.name,
                        option.key,
                        event.currentTarget.checked,
                      )}
                  />
                {:else if option.type === 'integer'}
                  <input
                    type="number"
                    min={option.min}
                    max={option.max}
                    step="1"
                    inputmode="numeric"
                    value={Number(selected.options[option.key])}
                    disabled={unavailable}
                    onchange={(event) =>
                      update(
                        module.name,
                        option.key,
                        event.currentTarget.valueAsNumber,
                      )}
                  />
                {:else}
                  <select
                    disabled={unavailable}
                    value={String(
                      option.choices?.findIndex(
                        (choice) =>
                          choice.value === selected.options[option.key],
                      ),
                    )}
                    onchange={(event) =>
                      update(
                        module.name,
                        option.key,
                        option.choices![Number(event.currentTarget.value)]
                          .value,
                      )}
                  >
                    {#each option.choices ?? [] as choice, index}<option
                        value={String(index)}>{choice.label}</option
                      >{/each}
                  </select>
                {/if}
              </label>
            {/each}
            {#each module.constraints as constraint}<p class="constraint">
                {constraint.message}
              </p>{/each}
          {/if}
        </fieldset>
      {/if}
    {/each}
  </div>
</section>

<style>
  .rule-settings {
    margin: 12px 0 22px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface-muted);
  }
  .rule-toggle-button {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 13px 14px;
    width: 100%;
    border: 0;
    border-radius: inherit;
    color: inherit;
    background: transparent;
    text-align: left;
    cursor: pointer;
    touch-action: manipulation;
  }
  .rules-heading {
    display: none;
  }
  .rule-fields[hidden] {
    display: none;
  }
  .rule-toggle-button strong {
    font-size: 12px;
    font-weight: 550;
  }
  .rule-toggle-button > span {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--muted);
    font-size: 10px;
  }
  .rule-toggle-button i {
    font-size: 17px;
    font-style: normal;
  }
  .rule-toggle-button[aria-expanded='true'] i {
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
  .rule-setting input[type='checkbox'] {
    flex: 0 0 21px;
    width: 21px;
    height: 21px;
    margin: 0;
    accent-color: var(--accent);
  }
  .rule-setting:has(:disabled) {
    cursor: default;
  }
  fieldset:disabled {
    opacity: 0.55;
  }
  .rule-fields > fieldset:last-child > .rule-setting:last-child {
    border-bottom: 0;
  }
  .rule-setting select,
  .rule-setting input[type='number'] {
    flex: 0 0 104px;
    width: 104px;
    max-width: 42%;
    min-height: 44px;
    padding: 0 9px;
    border: 1px solid var(--line);
    border-radius: 9px;
    color: var(--text);
    background: var(--surface);
    font: inherit;
    font-size: 16px;
  }
  .rule-setting:has(:disabled) > span {
    opacity: 0.65;
  }
  .module-description,
  .constraint {
    margin: 0;
    color: var(--muted);
    font-size: 11px;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }
  .constraint {
    margin-top: 6px;
  }
  .module-enable {
    border-bottom: 0;
    padding-top: 3px;
  }
  .rule-setting strong {
    overflow-wrap: anywhere;
  }
  @media (min-width: 700px) {
    .rule-settings {
      margin: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
    }
    .rule-toggle-button {
      display: none;
    }
    .rules-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      min-height: 48px;
      margin-bottom: 20px;
    }
    .rules-heading > div {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 12px;
    }
    h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
      line-height: 1.4;
      letter-spacing: -0.025em;
    }
    .rule-count {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }
    .restore-rules {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 44px;
      padding: 0 10px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .restore-rules:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .rule-groups {
      position: relative;
      display: grid;
      gap: 0;
      margin: 0 0 32px;
      padding: 0;
      width: fit-content;
      max-width: 100%;
      border-bottom: 1px solid var(--line-strong);
    }
    .rule-groups button {
      min-width: 0;
      min-height: 44px;
      padding: 0 12px 12px;
      border: 0;
      color: var(--muted);
      background: transparent;
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: color 160ms ease;
    }
    .rule-groups button.chosen {
      color: var(--text);
    }
    .rule-group-line {
      position: absolute;
      left: 0;
      bottom: -1px;
      height: 2px;
      background: var(--text);
      pointer-events: none;
      transition: transform 180ms var(--ease-out);
    }
    .rule-fields {
      display: grid;
      align-items: start;
      gap: 28px 36px;
      padding: 0;
      border: 0;
    }
    .rule-fields > fieldset {
      padding: 0 0 20px;
      border: 0;
      border-bottom: 1px solid var(--line);
    }
    legend {
      float: left;
      padding: 0;
      margin-bottom: 12px;
      font-size: 17px;
      font-weight: 600;
      line-height: 1.4;
      letter-spacing: -0.02em;
    }
    legend > span {
      display: none;
    }
    .module-description {
      clear: both;
      margin-bottom: 10px;
      font-size: 12px;
      line-height: 1.75;
    }
    .constraint {
      margin-top: 12px;
      font-size: 11px;
      line-height: 1.75;
    }
    .rule-setting {
      gap: 16px;
      min-height: 60px;
      padding: 14px 0;
    }
    .rule-setting:last-of-type {
      border-bottom: 0;
    }
    .rule-setting strong {
      font-size: 14px;
      line-height: 1.6;
    }
    .rule-setting small {
      font-size: 12px;
      line-height: 1.7;
    }
    .rule-setting input[type='checkbox'] {
      appearance: none;
      position: relative;
      width: 36px;
      height: 22px;
      flex-basis: 36px;
      border: 1px solid var(--line-strong);
      border-radius: 20px;
      background: var(--surface-inset);
      cursor: pointer;
      transition: background-color 160ms ease;
    }
    .rule-setting input[type='checkbox']::after {
      content: '';
      display: block;
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--muted);
      transition:
        transform 160ms var(--ease-out),
        background-color 160ms ease;
    }
    .rule-setting input[type='checkbox']:checked {
      border-color: var(--accent);
      background: var(--accent);
    }
    .rule-setting input[type='checkbox']:checked::after {
      background: var(--on-accent);
      transform: translateX(14px);
    }
    .rule-setting input[type='checkbox']:disabled {
      cursor: default;
      opacity: 0.45;
    }
    .rule-setting input[type='number'],
    .rule-setting select {
      flex-basis: 96px;
      width: 96px;
      min-height: 44px;
      border-color: var(--line-strong);
      background: var(--surface);
      font-size: 14px;
    }
    .module-enable {
      padding-top: 10px;
    }
  }
  @media (min-width: 1000px) {
    .rule-fields {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (hover: hover) and (pointer: fine) {
    .restore-rules:hover:not(:disabled) {
      color: var(--text);
      background: var(--hover);
    }
    .rule-groups button:hover:not(.chosen) {
      color: var(--text);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .rule-group-line {
      transition: none;
    }
    .rule-setting input[type='checkbox']::after {
      transition: background-color 120ms ease;
    }
  }
  :global(.gentle) .rule-setting input[type='checkbox']::after {
    transition: background-color 120ms ease;
  }
  :global(.gentle) .rule-group-line {
    transition: none;
  }
  @media (forced-colors: active) {
    .rule-setting input[type='checkbox'] {
      appearance: auto;
    }
    .rule-setting input[type='checkbox']::after {
      display: none;
    }
  }
</style>
