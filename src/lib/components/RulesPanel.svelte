<script lang="ts">
  import Icon from './Icon.svelte'
  import type { Room } from '../game/types'
  let { room, onclose }: { room: Room; onclose: () => void } = $props()
</script>

<div class="rule-intro">
  <span class="rule-intro-icon"><Icon name="cards" size={25} /></span>
  <div>
    <strong
      >{room.rules.some((r) => r.name === 'stacking')
        ? '经典 + 罚牌叠加'
        : '经典玩法'}</strong
    >
    <p>2–10 人 · 先出完手牌的人获胜</p>
  </div>
</div>
<ol class="rules-list">
  <li>
    <span>01</span>
    <div>
      <strong>同色，或同牌面</strong>
      <p>轮到你时，打出与上一张颜色、数字或动作相同的牌。万能牌可以换色。</p>
    </div>
  </li>
  <li>
    <span>02</span>
    <div>
      <strong>没合适的，就摸一张</strong>
      <p>
        摸牌后可以打出刚摸到的那张，或选择跳过。加牌、跳过和反转会改变局势。
      </p>
    </div>
  </li>
  <li>
    <span>03</span>
    <div>
      <strong>只剩一张，记得 UNO！</strong>
      <p>两秒内点中央 UNO 按钮，或按空格键。漏喊需要罚摸一张。</p>
    </div>
  </li>
</ol>
<div class="rule-note">
  <Icon name="shield" size={17} />
  <p>本局规则由房主创建时确定；出牌结果以服务器判定为准。</p>
</div>
<button class="button primary full" onclick={onclose}
  >返回牌桌<Icon name="arrow" size={17} /></button
>
