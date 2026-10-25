<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte'
  import RoomPanel from './RoomPanel.svelte'
  import RematchPanel from './RematchPanel.svelte'
  import Icon from './Icon.svelte'
  import SideRail from './SideRail.svelte'
  import RulesPanel from './RulesPanel.svelte'
  import Hand from './Hand.svelte'
  import Sheet from './Sheet.svelte'
  import TableBoard from './TableBoard.svelte'
  import { ApiClient, ApiError, errorMessage } from '../game/api'
  import { OnlineTransport } from '../game/online'
  import { unoDeclarationNotice } from '../game/announcements'
  import {
    allowedWildColors,
    matchingHint,
    readRuleOptions,
  } from '../game/rules'
  import {
    cardName,
    colorNames,
    suggestsPlayable,
    type Action,
    type ActionBody,
    type Card,
    type GameTransport,
    type PlayColor,
    type Room,
    type Session,
    type Snapshot,
  } from '../game/types'

  let {
    api,
    session,
    initialRoom,
    reduced,
    onleave,
    onSessionLost,
  }: {
    api: ApiClient
    session: Session
    initialRoom: Room
    reduced: boolean
    onleave: () => void
    onSessionLost: (error: ApiError) => void
  } = $props()
  type Panel = '' | 'room' | 'rules' | 'color'
  let port: GameTransport
  let unsubscribe = () => {}
  let room = $state.raw<Room>(untrack(() => initialRoom))
  let connection = $state<Snapshot['connection']>('connected')
  let selected = $state<number | null>(null),
    sorted = $state(false),
    busy = $state(false)
  let panel = $state<Panel>(''),
    retainedPanel = $state<Panel>('room')
  let now = $state(Date.now()),
    notice = $state(''),
    noticeVisible = $state(false)
  let noticeTimer: ReturnType<typeof setTimeout>
  let pendingWild = $state<number | null>(null)
  let activities = $state<{ text: string; key: number }[]>([])
  let alive = true
  let spectator = $derived(room.role === 'spectator')
  let observer = $derived(room.spectators?.find((p) => p.id === room.state.you))
  let me = $derived(room.state.players.find((p) => p.id === room.state.you))
  let bots = $derived(room.bots ?? {})
  let botCount = $derived(Object.keys(bots).length)
  let humanCount = $derived(
    room.state.players.filter(
      (p) => !bots[p.id] && !room.departed?.includes(p.id),
    ).length,
  )
  let botThinking = $derived(
    room.state.phase === 'playing' &&
      !!room.state.turn &&
      !!bots[room.state.turn],
  )
  let turnPlayer = $derived(
    room.state.players.find((p) => p.id === room.state.turn),
  )
  let myTurn = $derived(
    room.state.turn === room.state.you && room.state.phase === 'playing',
  )
  let selectedCard = $derived(me?.hand?.find((card) => card.id === selected))
  let wildColors = $derived(allowedWildColors(room))
  let playAnyAfterDraw = $derived(readRuleOptions(room.rules).playAnyAfterDraw)
  const colors: PlayColor[] = ['red', 'yellow', 'green', 'blue']
  let playable = $derived(
    selectedCard ? suggestsPlayable(selectedCard, room) : false,
  )
  let remaining = $derived(
    me?.uno ? Math.max(0, Date.parse(me.uno.deadline) - now) : 0,
  )
  let panelTitle = $derived(
    {
      room: '房间',
      rules: '本局规则',
      color: '选择颜色',
      '': '',
    }[retainedPanel],
  )
  $effect.pre(() => {
    if (panel) retainedPanel = panel
  })
  function showNotice(text: string) {
    notice = text
    noticeVisible = true
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => {
      noticeVisible = false
    }, 3500)
  }

  function attach(next: GameTransport) {
    unsubscribe()
    port?.dispose()
    port = next
    busy = false
    selected = null
    activities = []
    let previous: Room | undefined
    unsubscribe = next.subscribe((snapshot) => {
      const current = snapshot.room
      if (previous && current.state.version > previous.state.version) {
        const unoNotice = unoDeclarationNotice(previous.state, current.state)
        if (unoNotice) showNotice(unoNotice)
        let text = ''
        const actor = previous.state.players.find(
          (p) => p.id === previous!.state.turn,
        )
        const nextMe = current.state.players.find(
          (p) => p.id === current.state.you,
        )
        const prevMe = previous.state.players.find(
          (p) => p.id === previous!.state.you,
        )
        if (unoNotice) text = unoNotice
        else if (
          current.state.top_card?.id !== previous.state.top_card?.id &&
          current.state.top_card
        )
          text = `${actor?.id === current.state.you ? '你' : actor?.name || '玩家'}打出${cardName(current.state.top_card)}`
        else if (nextMe && prevMe && nextMe.hand_count > prevMe.hand_count)
          text = `你摸了 ${nextMe.hand_count - prevMe.hand_count} 张牌`
        else if (
          current.state.phase === 'playing' &&
          previous.state.phase === 'lobby'
        )
          text = '发牌完成'
        if (text)
          activities = [
            { text, key: current.state.version },
            ...activities,
          ].slice(0, 4)
        if (current.state.turn !== previous.state.turn) selected = null
      }
      if (previous && current.round !== previous.round) {
        selected = null
        pendingWild = null
        panel = ''
        activities = []
        showNotice('新的一局开始了。')
      }
      room = current
      connection = snapshot.connection
      previous = current
    })
  }
  function sessionLost(error: ApiError) {
    onSessionLost(
      error.code === 'room_not_found'
        ? new ApiError('room_closed', '房间已解散或已过期。', 404)
        : error,
    )
  }
  untrack(() => attach(new OnlineTransport(api, session, room, sessionLost)))

  async function run(
    action: Action,
    body: ActionBody = {},
    silent = false,
  ): Promise<boolean> {
    const target = port
    const independent = action === 'uno' || action === 'uno-penalty'
    if (busy && !independent) return false
    if (!independent) busy = true
    try {
      await target.act(action, body)
      if (target !== port || !alive) return false
      if (action === 'play') selected = null
      if (action === 'uno-penalty') showNotice('漏喊 UNO，罚摸一张。')
      return true
    } catch (error) {
      if (target === port && alive && !silent) showNotice(errorMessage(error))
      if (silent) throw error
      return false
    } finally {
      if (target === port && !independent) busy = false
    }
  }

  function selectCard(card: Card) {
    selected = selected === card.id ? null : card.id
    if (!suggestsPlayable(card, room))
      showNotice(
        room.state.can_pass
          ? playAnyAfterDraw
            ? '这张牌不符合本局规则，请选择其他手牌或跳过。'
            : '摸牌后只能出刚摸到的那张，或选择跳过。'
          : room.state.pending_draw
            ? '这张牌不能接当前罚牌，请按本局规则接牌或摸牌。'
            : matchingHint(
                room.rules,
                room.state.active_color,
                room.state.top_card?.kind,
              ),
      )
  }
  function playSelected() {
    if (!selectedCard || busy) return
    if (selectedCard.color === 'wild') {
      pendingWild = selectedCard.id
      panel = 'color'
    } else void run('play', { card_id: selectedCard.id })
  }
  function chooseColor(color: PlayColor) {
    if (panel !== 'color' || busy || !myTurn || !wildColors.includes(color))
      return
    const id = pendingWild
    panel = ''
    pendingWild = null
    if (id !== null) void run('play', { card_id: id, color })
  }
  function sayUNO() {
    if (me?.uno) void run('uno', { window_id: me.uno.id })
  }
  function onKey(event: KeyboardEvent) {
    const target = event.target as HTMLElement
    if (
      event.code !== 'Space' ||
      event.repeat ||
      document.querySelector('dialog[open]') ||
      target.closest('input, textarea, select, [contenteditable="true"]')
    )
      return
    if (me?.uno) {
      event.preventDefault()
      sayUNO()
    }
  }

  // 仅 UNO 操作按窗口 ID 幂等重试；普通动作不自动重发。
  $effect(() => {
    const window = me?.uno
    const target = port
    if (!window) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    async function settle() {
      if (cancelled || target !== port) return
      try {
        await run('uno-penalty', { window_id: window!.id }, true)
      } catch (error) {
        if (
          !cancelled &&
          error instanceof ApiError &&
          ['uno_too_early', 'network_error', 'version_conflict'].includes(
            error.code,
          )
        )
          timer = setTimeout(() => void settle(), 500)
      }
    }
    timer = setTimeout(
      () => void settle(),
      Math.max(0, Date.parse(window.deadline) - Date.now()) + 80,
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  })

  async function invite(codeOnly = false, watch = false) {
    const text = codeOnly
      ? room.id
      : `${location.origin}${location.pathname}?room=${encodeURIComponent(room.id)}${watch ? '&watch=1' : ''}`
    try {
      await navigator.clipboard.writeText(text)
      showNotice(
        codeOnly
          ? '房间号已复制。'
          : watch
            ? '观战链接已复制。'
            : '邀请链接已复制。',
      )
    } catch {
      showNotice(`房间号：${room.id}，可在房间面板中选中复制。`)
    }
  }
  async function exitRoom(operation: () => Promise<unknown>) {
    if (busy) return
    busy = true
    // Cancel polling before revoking our own session to avoid reporting a
    // successful exit as an authentication failure in a racing GET.
    port.dispose()
    try {
      await operation()
      if (alive) onleave()
    } catch (error) {
      if (alive) {
        attach(new OnlineTransport(api, session, room, sessionLost))
        showNotice(errorMessage(error))
      }
    } finally {
      if (alive) busy = false
    }
  }
  function dissolve() {
    return exitRoom(() => api.dissolve(session))
  }
  function leave() {
    return exitRoom(() => api.leave(session))
  }
  onMount(() => {
    window.scrollTo(0, 0)
    const ticker = setInterval(() => {
      now = Date.now()
    }, 50)
    return () => clearInterval(ticker)
  })
  onDestroy(() => {
    alive = false
    unsubscribe()
    port?.dispose()
    clearTimeout(noticeTimer)
  })
</script>

<svelte:window onkeydown={onKey} />
<main class="game-layout" class:reconnecting={connection === 'reconnecting'}>
  <section class="game-panel" aria-label="UNOur 游戏">
    <div class="room-heading">
      <div>
        <div class="eyebrow">
          <span class="tiny-leaf"><Icon name="leaf" size={12} /></span>牌局
        </div>
        <h1>
          {botCount
            ? humanCount > 1
              ? '混合牌局'
              : '人机对局'
            : '联机牌局'}<span class="room-tag"
            >{room.state.players.length - (room.departed?.length ?? 0)} 人</span
          >
        </h1>
      </div>
      <div class="room-tools">
        <button
          class="icon-button"
          aria-label="查看本局规则"
          onclick={() => {
            panel = 'rules'
          }}><Icon name="info" size={19} /></button
        ><button
          class="icon-button"
          aria-label="打开房间与邀请"
          onclick={() => {
            panel = 'room'
          }}><Icon name="users" size={19} /></button
        >
      </div>
    </div>
    <TableBoard
      {room}
      {busy}
      {remaining}
      {reduced}
      ondraw={() => void run('draw')}
      onuno={sayUNO}
    />
    <div class="turn-strip" class:your-turn={myTurn} role="status">
      <span class="turn-indicator"><i></i></span>
      <div>
        <strong
          >{room.state.phase === 'lobby'
            ? '等待开局'
            : room.state.phase === 'finished'
              ? '本局已结束'
              : myTurn
                ? '轮到你出牌'
                : botThinking
                  ? '电脑正在思考…'
                  : `等待${turnPlayer?.name || '玩家'}出牌`}</strong
        ><span
          >{room.state.phase === 'lobby'
            ? `房间内 ${room.state.players.length} 位玩家`
            : room.state.phase === 'finished'
              ? '查看本局结果'
              : myTurn
                ? room.state.can_pass
                  ? playAnyAfterDraw
                    ? '可以出任意符合规则的手牌，或跳过'
                    : '可以打出刚摸到的牌，或跳过'
                  : room.state.pending_draw
                    ? `承受 ${room.state.pending_draw} 张罚牌，或按规则接牌`
                    : matchingHint(
                        room.rules,
                        room.state.active_color,
                        room.state.top_card?.kind,
                      )
                : '等待当前玩家完成操作'}</span
        >
      </div>
      <span class="turn-side"
        >{room.state.phase === 'playing'
          ? '进行中'
          : room.state.phase === 'finished'
            ? '已结束'
            : '未开始'}</span
      >
    </div>
    {#if room.state.phase === 'finished'}
      <RematchPanel
        {room}
        {busy}
        vote={(agree) =>
          void run('rematch', {
            agree,
            round: room.round ?? 1,
            roster_version: room.roster_version ?? 0,
          })}
      />
    {:else if spectator}
      <div class="spectator-note" role="status">
        <strong>正在观战</strong><span
          >{observer?.next_round
            ? '已预约下一局席位，结算后需同意再来一局。'
            : '观战不展示任何玩家手牌。'}</span
        >
      </div>
    {:else}
      <Hand
        {room}
        {selected}
        {sorted}
        {busy}
        {reduced}
        onselect={selectCard}
        onsort={() => {
          sorted = !sorted
        }}
      />
    {/if}
    <div class="action-bar">
      {#if spectator}
        <button class="button secondary" onclick={() => (panel = 'room')}
          >房间与邀请</button
        >
        <button
          class="button primary"
          disabled={busy}
          onclick={() =>
            void run('participation', { next_round: !observer?.next_round })}
          >{observer?.next_round
            ? '取消下局入座'
            : room.state.phase === 'lobby'
              ? '入座'
              : '报名下一局'}</button
        >
      {:else if room.state.phase === 'lobby'}
        {#if botCount}
          <button class="button primary" onclick={() => void leave()}
            >返回大厅<Icon name="arrow" size={18} /></button
          >
        {:else}
          <button class="button secondary" onclick={() => void invite()}
            ><Icon name="link" size={17} />邀请朋友</button
          ><button
            class="button primary"
            disabled={room.host_id !== room.state.you ||
              room.state.players.length < 2 ||
              busy}
            onclick={() => void run('start')}
            >{busy
              ? '正在发牌…'
              : room.host_id === room.state.you
                ? '开始游戏'
                : '等待房主开局'}<Icon name="arrow" size={18} /></button
          >
        {/if}
      {:else if room.state.phase === 'finished'}
        <button
          class="button secondary"
          onclick={() => {
            panel = 'room'
          }}
          ><Icon name="users" size={17} />{botCount
            ? '对局信息'
            : '房间信息'}</button
        ><button class="button primary" onclick={() => void leave()}
          >返回大厅<Icon name="arrow" size={18} /></button
        >
      {:else}
        <button
          class="button secondary draw-button"
          disabled={!myTurn || busy}
          onclick={() =>
            room.state.can_pass ? void run('pass') : void run('draw')}
          ><Icon name={room.state.can_pass ? 'arrow' : 'plus'} size={19} />{room
            .state.can_pass
            ? '跳过'
            : room.state.pending_draw
              ? `摸 ${room.state.pending_draw} 张`
              : '摸一张'}</button
        >
        {#if room.state.challenge_target && myTurn}<button
            class="challenge-button"
            onclick={() => void run('challenge')}
            disabled={busy}
            aria-label="质疑加四"
            ><Icon name="shield" size={19} /><span>质疑</span></button
          >{/if}
        <button
          class="button primary play-button"
          disabled={!myTurn || !selectedCard || busy}
          onclick={playSelected}
          >{busy
            ? '正在确认…'
            : !myTurn
              ? '等待回合'
              : selectedCard
                ? playable
                  ? '打出这张牌'
                  : '尝试打出这张'
                : '选择一张牌'}<Icon name="arrow" size={19} /></button
        >
      {/if}
    </div>
    <div class="panel-footnote">
      <span class="mini-colors" aria-hidden="true"
        ><i></i><i></i><i></i><i></i></span
      >
    </div>
  </section>
  <SideRail
    {room}
    {activities}
    {invite}
    openRules={() => {
      panel = 'rules'
    }}
  />
</main>
<footer class="desktop-footer">
  <span>UNOur</span><button
    class="text-button"
    onclick={() => {
      panel = 'rules'
    }}>游戏规则<Icon name="arrow" size={13} /></button
  >
</footer>
<output
  class="notice"
  class:visible={noticeVisible}
  aria-live="polite"
  aria-hidden={!noticeVisible}
  ><span class="notice-icon"><Icon name="info" size={16} /></span
  >{notice}</output
>

<Sheet
  open={!!panel}
  title={panelTitle}
  description={retainedPanel === 'room'
    ? '邀请、观战与房间管理。'
    : retainedPanel === 'color'
      ? '选择接下来的出牌颜色。'
      : ''}
  {reduced}
  onclose={() => {
    panel = ''
    pendingWild = null
  }}
>
  {#if retainedPanel === 'color'}
    <div class="color-options">
      {#each colors as color}<button
          class={`color-option ${color}`}
          disabled={busy || !wildColors.includes(color)}
          aria-label={color === room.state.active_color
            ? `${colorNames[color]}，${wildColors.includes(color) ? '保留当前色' : '本局必须换色'}`
            : colorNames[color]}
          onclick={() => chooseColor(color)}
          ><span>{{ red: '●', yellow: '◆', green: '■', blue: '▲' }[color]}</span
          >{color === room.state.active_color && wildColors.includes(color)
            ? '保留当前色'
            : colorNames[color]}</button
        >{/each}
    </div>
    <p class="color-rule-note">
      {wildColors.length === 4
        ? '本局允许保留当前颜色。'
        : '本局必须选择其他颜色。'}
    </p>
  {:else if retainedPanel === 'rules'}
    <RulesPanel
      {room}
      onclose={() => {
        panel = ''
      }}
    />
  {:else}
    <RoomPanel
      {room}
      {busy}
      {invite}
      participate={(nextRound) =>
        void run('participation', { next_round: nextRound })}
      dissolve={() => void dissolve()}
      leave={() => void leave()}
    />
  {/if}
</Sheet>

<style>
  .spectator-note {
    display: grid;
    gap: 8px;
    padding: 26px 16px;
    text-align: center;
  }
  .spectator-note strong {
    font-size: 14px;
  }
  .spectator-note span {
    font-size: 12px;
    line-height: 1.7;
    opacity: 0.65;
  }
</style>
