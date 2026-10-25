<script lang="ts">
  import {
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

<details class="rule-settings">
  <summary
    ><strong>自定义规则</strong><span
      >{changed ? `${changed} 项调整` : '默认规则'}<i aria-hidden="true">⌄</i
      ></span
    ></summary
  >
  <div class="rule-fields">
    {#each catalog.modules as module (module.name)}
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
</style>
