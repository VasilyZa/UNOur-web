<script lang="ts">
  import Icon from './Icon.svelte'
  import type { Room } from '../game/types'
  import { readRuleOptions } from '../game/rules'
  let { room, onclose }: { room: Room; onclose: () => void } = $props()
  let options = $derived(readRuleOptions(room.rules))
  let playDrawn = $derived(
    room.rules.some(
      (rule) => rule.name === 'draw' && rule.options?.play_drawn_card !== false,
    ),
  )
  let multiplier = $derived(
    (Number(
      room.rules.find((rule) => rule.name === 'challenge')?.options
        ?.failure_multiplier,
    ) || 150) / 100,
  )
  let details = $derived([
    {
      title:
        options.sameColor && options.sameValue
          ? '同色或同数字接牌'
          : options.sameColor
            ? '仅同色接牌'
            : options.sameValue
              ? '仅同数字接牌'
              : '自定义匹配',
      text:
        options.sameColor && options.sameValue
          ? '可以出当前颜色、相同数字或相同动作的牌。'
          : options.sameColor
            ? '普通牌按当前颜色接牌，不能仅凭同数字或同动作接牌。'
            : options.sameValue
              ? '普通牌按相同数字或相同动作接牌；万能牌之后允许按指定颜色接牌。'
              : '出牌按服务器配置判定。',
    },
    {
      title: '摸牌与跳过',
      text: `没有合适的牌可以摸一张。${playDrawn ? (options.playAnyAfterDraw ? '摸牌后可出任意符合本局规则的手牌，或选择跳过。' : '可以打出刚摸到的牌，或选择跳过。') : '摸牌后直接结束回合。'}${options.skipDraw ? '禁牌会让被跳过者额外摸一张。' : '禁牌只跳过下家，不额外摸牌。'}`,
    },
    {
      title: '万能牌换色',
      text: options.keepColor
        ? '换色牌和 +4 都可以选择新颜色，也可以保留当前颜色。'
        : '换色牌和 +4 必须选择其他颜色。',
    },
    {
      title: options.stacking ? '允许罚牌叠加' : '关闭罚牌叠加',
      text: options.stacking
        ? `${options.mixedStacking ? '+2 与 +4 可混合叠加。' : '只能叠加同类罚牌。'}${options.differentColorStacking ? '+2 可以异色叠加。' : '+2 接牌必须符合当前颜色。'}${options.reverseStacking ? '可用反转牌把罚牌转给上家，并连续接反转。' : '反转牌不能转移罚牌。'}`
        : '收到 +2 或 +4 后，按当前罚牌池摸牌并结束回合；不能叠加或用反转转移。',
    },
    {
      title: options.challenge ? '允许 +4 质疑' : '关闭 +4 质疑',
      text: options.challenge
        ? `质疑成功，最近 +4 出牌者承担当前罚牌池，你保留回合；失败时承担罚牌池的 ${multiplier} 倍并结束回合。`
        : '持有当前颜色的普通牌时不能打 +4，其他玩家也不能质疑 +4。',
    },
    {
      title: '只剩一张，记得 UNO！',
      text: '两秒内点中央 UNO 按钮，或按空格键。漏喊需要罚摸一张。',
    },
  ])
</script>

<div class="rule-intro">
  <span class="rule-intro-icon"><Icon name="cards" size={25} /></span>
  <div>
    <strong>本局配置</strong>
    <p>2–10 人 · 先出完手牌的人获胜</p>
  </div>
</div>
<ol class="rules-list">
  {#each details as item, index}
    <li>
      <span>{String(index + 1).padStart(2, '0')}</span>
      <div>
        <strong>{item.title}</strong>
        <p>{item.text}</p>
      </div>
    </li>
  {/each}
</ol>
<div class="rule-note">
  <Icon name="shield" size={17} />
  <p>本局规则由房主创建时确定；出牌结果以服务器判定为准。</p>
</div>
<button class="button primary full" onclick={onclose}
  >返回牌桌<Icon name="arrow" size={17} /></button
>
