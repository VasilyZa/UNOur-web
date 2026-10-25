<script lang="ts">
  import Icon from './Icon.svelte'
  import { botDifficultyNames, type Room } from '../game/types'
  let {
    room,
    activities,
    invite,
    openRules,
  }: {
    room: Room
    activities: { text: string; key: number }[]
    invite: (codeOnly?: boolean) => Promise<void>
    openRules: () => void
  } = $props()
  let bots = $derived(room.bots ?? {})
  let botCount = $derived(Object.keys(bots).length)
  let botDifficulty = $derived(
    botCount ? botDifficultyNames[Object.values(bots)[0].difficulty] : '',
  )
</script>

<aside class="side-rail" aria-label={botCount ? '对局信息' : '房间信息'}>
  <section class="rail-card intro-card">
    <div class="eyebrow">UNOur</div>
    <h2>{botCount ? '人机对战' : 'UNO 在线牌桌'}</h2>
    <p>
      {#if botCount}
        {room.state.players.length - botCount} 位玩家与 {botCount} 台电脑<br
        />{botDifficulty}难度 · 标准 108 张牌
      {:else}
        2–10 人<br />标准 108 张牌
      {/if}
    </p>
    <div class="intro-art" aria-hidden="true">
      <span>U</span><span>N</span><span>O</span>
    </div>
  </section>
  <section class="rail-card">
    <div class="rail-title">
      <h3>{botCount ? '对局信息' : '房间信息'}</h3>
      <span class="small-badge">{botCount ? '人机对局' : '联机中'}</span>
    </div>
    <button
      class="room-id"
      onclick={() => void invite(true)}
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
      {#if botCount}<span>电脑</span><span>{botCount} 台 · {botDifficulty}</span
        >{/if}
    </div>
    <button class="button rail-invite" onclick={() => void invite()}>
      <Icon name="users" size={16} />邀请玩家
    </button>
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
          <i></i>已加入牌局
        </p>{/if}
    </div>
  </section>
</aside>
