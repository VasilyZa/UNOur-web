<script lang="ts">
  import Icon from './Icon.svelte'
  import type { Room } from '../game/types'
  let {
    room,
    mode,
    activities,
    invite,
    showNotice,
    openRoom,
    openRules,
  }: {
    room: Room
    mode: 'demo' | 'online'
    activities: { text: string; key: number }[]
    invite: (codeOnly?: boolean) => Promise<void>
    showNotice: (text: string) => void
    openRoom: () => void
    openRules: () => void
  } = $props()
</script>

<aside class="side-rail" aria-label="房间信息">
  <section class="rail-card intro-card">
    <div class="eyebrow">MAKE YOURSELF AT HOME</div>
    <h2>把朋友聚在一起，<br />把好时光留在桌上。</h2>
    <p>一张牌的距离，<br />刚好够说声 UNO。</p>
    <div class="intro-art" aria-hidden="true">
      <span>U</span><span>N</span><span>O</span>
    </div>
  </section>
  <section class="rail-card">
    <div class="rail-title">
      <h3>这一桌</h3>
      <span class="small-badge">{mode === 'demo' ? '试玩中' : '联机中'}</span>
    </div>
    <button
      class="room-id"
      onclick={() =>
        mode === 'online'
          ? void invite(true)
          : showNotice('这是试玩房间，点下方按钮创建真实房间。')}
      aria-label="复制房间号"
      ><span>ROOM</span><strong>{room.id}</strong><Icon
        name="copy"
        size={15}
      /></button
    >
    <div class="room-facts">
      <span>规则</span><button class="text-button" onclick={openRules}
        >{room.rules.some((r) => r.name === 'stacking')
          ? '叠加玩法'
          : '经典玩法'}<Icon name="chevron" size={13} /></button
      ><span>玩家</span><span>{room.state.players.length} / 10 位</span>
    </div>
    <button
      class="button rail-invite"
      onclick={() => (mode === 'online' ? void invite() : openRoom())}
      ><Icon name="users" size={16} />{mode === 'demo'
        ? '和朋友开一桌'
        : '邀请朋友入座'}</button
    >
  </section>
  <section class="rail-card activity-card">
    <div class="rail-title">
      <h3>牌桌动态</h3>
      <span class="live-dot"></span>
    </div>
    <div class="activity-list" aria-live="polite">
      {#each activities as activity (activity.key)}<p>
          <i></i>{activity.text}
        </p>{/each}{#if !activities.length}<p>
          <i></i>{mode === 'demo'
            ? '牌已发好，先从你开始'
            : '大家陆续入座，好戏快开场'}
        </p>{/if}
    </div>
  </section>
  <p class="rail-signature">A little luck. A lot of us.</p>
</aside>
