import type { Card, PlayColor, Room, RuleScalar, RuleSpec } from './types'

export interface RuleOption {
  key: string
  type: 'boolean' | 'integer' | 'select'
  label: string
  description?: string
  default: RuleScalar
  min?: number
  max?: number
  choices?: { value: RuleScalar; label: string }[]
  depends_on?: { key: string; equals: RuleScalar }[]
}
export interface RuleConstraint {
  kind: 'at_least_one'
  fields: string[]
  message: string
}
export interface RuleDescriptor {
  name: string
  version: number
  order: number
  title: string
  description?: string
  group?: string
  required: boolean
  default_enabled: boolean
  options: RuleOption[]
  constraints: RuleConstraint[]
}
export interface RuleCatalog {
  revision: string
  modules: RuleDescriptor[]
}
export interface RuleDescription {
  name: string
  title: string
  text: string[]
}
export type RuleSelection = Record<
  string,
  { enabled: boolean; options: Record<string, RuleScalar> }
>

function validValue(
  option: RuleOption,
  value: RuleScalar | undefined,
): boolean {
  if (typeof value !== typeof option.default) return false
  if (option.type === 'boolean') return typeof value === 'boolean'
  if (option.type === 'integer')
    return (
      typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= (option.min ?? 0) &&
      value <= (option.max ?? 0)
    )
  return !!option.choices?.some((choice) => choice.value === value)
}

export function createRuleSelection(
  catalog: RuleCatalog,
  previous: RuleSelection = {},
): RuleSelection {
  return Object.fromEntries(
    catalog.modules.map((module) => {
      const old = Object.hasOwn(previous, module.name)
        ? previous[module.name]
        : undefined
      const options = Object.fromEntries(
        module.options.map((option) => {
          const value = old?.options[option.key]
          return [
            option.key,
            validValue(option, value) ? value! : option.default,
          ]
        }),
      )
      // A changed catalog can add a new constraint to previously valid choices.
      for (const constraint of module.constraints) {
        if (!constraint.fields.some((key) => options[key] === true))
          for (const key of constraint.fields)
            options[key] = module.options.find(
              (option) => option.key === key,
            )!.default
      }
      return [
        module.name,
        {
          enabled: module.required || (old?.enabled ?? module.default_enabled),
          options,
        },
      ]
    }),
  )
}

/** Resolve dependency chains using effective parent values, without losing a
 * preference that should return when its parent is enabled again. */
export function effectiveRuleOptions(
  module: RuleDescriptor,
  requested: Record<string, RuleScalar>,
): Record<string, RuleScalar> {
  const effective: Record<string, RuleScalar> = Object.create(null)
  const visiting = new Set<string>()
  const resolve = (option: RuleOption): RuleScalar => {
    if (Object.hasOwn(effective, option.key)) return effective[option.key]
    if (visiting.has(option.key))
      throw new Error('规则选项依赖循环，请刷新规则。')
    visiting.add(option.key)
    const enabled = (option.depends_on ?? []).every((dep) => {
      const parent = module.options.find((item) => item.key === dep.key)
      return !!parent && resolve(parent) === dep.equals
    })
    const value = enabled
      ? (requested[option.key] ?? option.default)
      : option.default
    visiting.delete(option.key)
    effective[option.key] = value
    return value
  }
  for (const option of module.options) resolve(option)
  return effective
}

export function optionAvailable(
  module: RuleDescriptor,
  option: RuleOption,
  requested: Record<string, RuleScalar>,
): boolean {
  const values = effectiveRuleOptions(module, requested)
  return (option.depends_on ?? []).every(
    (dep) => values[dep.key] === dep.equals,
  )
}

export function isLastRequiredChoice(
  module: RuleDescriptor,
  key: string,
  requested: Record<string, RuleScalar>,
): boolean {
  const values = effectiveRuleOptions(module, requested)
  return (
    values[key] === true &&
    module.constraints.some(
      (constraint) =>
        constraint.fields.includes(key) &&
        !constraint.fields.some(
          (other) => other !== key && values[other] === true,
        ),
    )
  )
}

export function buildRuleSpecs(
  catalog: RuleCatalog,
  selection: RuleSelection,
): RuleSpec[] {
  return catalog.modules
    .filter((module) => module.required || selection[module.name]?.enabled)
    .map((module) => {
      const options = effectiveRuleOptions(
        module,
        selection[module.name]?.options ?? {},
      )
      for (const option of module.options)
        if (!validValue(option, options[option.key]))
          throw new Error(`请检查“${option.label}”的取值。`)
      for (const constraint of module.constraints)
        if (!constraint.fields.some((key) => options[key] === true))
          throw new Error(constraint.message)
      return { name: module.name, version: module.version, options }
    })
}

/** No client-side policy IDs: the server validates every possible color. */
export function allowedWildColors(
  room: Room,
  selected: Card | null,
): PlayColor[] {
  if (!selected) return []
  return ['red', 'yellow', 'green', 'blue'].filter((color) =>
    room.state.legal_actions?.some(
      (action) =>
        action.action === 'play' &&
        action.card_id === selected.id &&
        action.color === color,
    ),
  ) as PlayColor[]
}
