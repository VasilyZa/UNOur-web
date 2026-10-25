import { describe, expect, it } from 'vitest'
import {
  buildRuleSpecs,
  createRuleSelection,
  effectiveRuleOptions,
  type RuleCatalog,
} from './rules'

const catalog: RuleCatalog = {
  revision: 'catalog-v1',
  modules: [
    {
      name: 'extension_from_file',
      version: 3,
      order: 10,
      title: '文件扩展',
      required: true,
      default_enabled: true,
      options: [
        { key: 'color', type: 'boolean', label: '同色', default: true },
        { key: 'value', type: 'boolean', label: '同值', default: false },
        {
          key: 'amount',
          type: 'integer',
          label: '数量',
          default: 2,
          min: 1,
          max: 9,
        },
        {
          key: 'mode',
          type: 'select',
          label: '模式',
          default: 'gentle',
          choices: [
            { value: 'gentle', label: '温和' },
            { value: 'strict', label: '严格' },
          ],
        },
        {
          key: 'extra',
          type: 'boolean',
          label: '附加',
          default: false,
          depends_on: [{ key: 'value', equals: true }],
        },
      ],
      constraints: [
        {
          kind: 'at_least_one',
          fields: ['color', 'value'],
          message: '至少一种匹配',
        },
      ],
    },
    {
      name: 'optional_from_file',
      version: 1,
      order: 20,
      title: '可选模块',
      required: false,
      default_enabled: false,
      options: [],
      constraints: [],
    },
  ],
}

describe('configuration-driven selection', () => {
  it('builds unknown module names and scalar types from metadata', () => {
    const selection = createRuleSelection(catalog)
    selection.extension_from_file.options.amount = 4
    selection.extension_from_file.options.mode = 'strict'
    selection.optional_from_file.enabled = true
    expect(buildRuleSpecs(catalog, selection)).toEqual([
      {
        name: 'extension_from_file',
        version: 3,
        options: {
          color: true,
          value: false,
          amount: 4,
          mode: 'strict',
          extra: false,
        },
      },
      { name: 'optional_from_file', version: 1, options: {} },
    ])
  })
  it('keeps dependent preferences while resetting inactive values in requests', () => {
    const selection = createRuleSelection(catalog)
    selection.extension_from_file.options.extra = true
    expect(
      effectiveRuleOptions(
        catalog.modules[0],
        selection.extension_from_file.options,
      ).extra,
    ).toBe(false)
    expect(selection.extension_from_file.options.extra).toBe(true)
    selection.extension_from_file.options.value = true
    expect(buildRuleSpecs(catalog, selection)[0].options?.extra).toBe(true)
  })
  it('validates generic bounds and at-least-one constraints', () => {
    const selection = createRuleSelection(catalog)
    selection.extension_from_file.options.color = false
    expect(() => buildRuleSpecs(catalog, selection)).toThrow('至少一种匹配')
    selection.extension_from_file.options.color = true
    selection.extension_from_file.options.amount = 10
    expect(() => buildRuleSpecs(catalog, selection)).toThrow('数量')
  })
  it('merges only still-valid preferences when a catalog changes', () => {
    const selection = createRuleSelection(catalog)
    selection.extension_from_file.options.mode = 'removed-value'
    selection.extension_from_file.options.amount = 5
    const next = createRuleSelection(catalog, selection)
    expect(next.extension_from_file.options.mode).toBe('gentle')
    expect(next.extension_from_file.options.amount).toBe(5)
  })
})
