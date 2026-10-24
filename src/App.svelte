<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import Icon from './lib/components/Icon.svelte'
  import SideRail from './lib/components/SideRail.svelte'
  import RulesPanel from './lib/components/RulesPanel.svelte'
  import PreferencesPanel from './lib/components/PreferencesPanel.svelte'
  import Hand from './lib/components/Hand.svelte'
  import Sheet from './lib/components/Sheet.svelte'
  import TableBoard from './lib/components/TableBoard.svelte'
  import { ApiClient, ApiError, errorMessage } from './lib/game/api'
  import { DemoTransport } from './lib/game/demo'
  import { OnlineTransport } from './lib/game/online'
  import { readSession, saveSession } from './lib/game/session'
  import {
    restoreRoomSession,
    sessionForInvitation,
  } from './lib/game/bootstrap'
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
  } from './lib/game/types'

  type Panel = '' | 'room' | 'rules' | 'settings' | 'color'
  const api = new ApiClient()
  let port: GameTransport
  let unsubscribe = () => {}
  let room = $state.raw<Room>(null!)
  let mode = $state<'demo' | 'online'>('demo')
  let connection = $state<Snapshot['connection']>('demo')
  let selected = $state<number | null>(null)
  let sorted = $state(false)
  let busy = $state(false)
  let joining = $state(false)
  let panel = $state<Panel>('')
  let roomMode = $state<'create' | 'join'>('create')
  let nickname = $state('')
  let roomCode = $state('')
  let stacking = $state(false)
  let formError = $state('')
  let quietMotion = $state(false)
  let systemReduced = $state(false)
  let now = $state(Date.now())
  let notice = $state('')
  let noticeVisible = $state(false)
  let noticeTimer: ReturnType<typeof setTimeout>
  let pendingWild = $state<number | null>(null)
  let savedSession = $state<Session | null>(null)
  let activities = $state<{ text: string; key: number }[]>([])
  let alive = true

  let me = $derived(room.state.players.find((p) => p.id === room.state.you))
  let turnPlayer = $derived(
    room.state.players.find((p) => p.id === room.state.turn),
  )
  let myTurn = $derived(
    room.state.turn === room.state.you && room.state.phase === 'playing',
  )
  let selectedCard = $derived(me?.hand?.find((card) => card.id === selected))
  let playable = $derived(
    selectedCard ? suggestsPlayable(selectedCard, room) : false,
  )
  let reduced = $derived(quietMotion || systemReduced)
  let remaining = $derived(
    me?.uno ? Math.max(0, Date.parse(me.uno.deadline) - now) : 0,
  )
  let panelTitle = $derived(
    {
      room: '和朋友坐一桌',
      rules: '这一桌的规则',
      settings: '让牌桌更合心意',
      color: '接下来，出什么颜色？',
      '': '',
    }[panel],
  )

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
    mode = next.mode
    selected = null
    activities = []
    let previous: Room | undefined
    unsubscribe = next.subscribe((snapshot) => {
      const current = snapshot.room
      if (previous && current.state.version > previous.state.version) {
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
        if (
          current.state.top_card?.id !== previous.state.top_card?.id &&
          current.state.top_card
        )
          text = `${actor?.id === current.state.you ? '你' : actor?.name || '玩家'}打出${cardName(current.state.top_card)}`
        else if (nextMe && prevMe && nextMe.hand_count > prevMe.hand_count)
          text = `你摸了 ${nextMe.hand_count - prevMe.hand_count} 张牌`
        else if (prevMe?.uno && !nextMe?.uno && nextMe?.hand_count === 1)
          text = '你喊出了 UNO！'
        else if (
          current.state.phase === 'playing' &&
          previous.state.phase === 'lobby'
        )
          text = '发牌完成，好戏开场'
        if (text)
          activities = [
            { text, key: current.state.version },
            ...activities,
          ].slice(0, 4)
        if (current.state.turn !== previous.state.turn) selected = null
      }
      room = current
      connection = snapshot.connection
      previous = current
    })
  }
  attach(new DemoTransport())

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
      if (action === 'uno') showNotice('UNO！这一声，喊得漂亮。')
      if (action === 'uno-penalty')
        showNotice('错过了 UNO，罚摸一张。下次记得喊！')
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
          ? '摸牌后只能出刚摸到的那张，或选择跳过。'
          : '提示：优先选择相同颜色、数字，或万能牌。',
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
      panel ||
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

  async function enterRoom(event: SubmitEvent) {
    event.preventDefault()
    if (joining) return
    formError = ''
    const name = nickname.trim()
    if (!name) {
      formError = '先告诉朋友们怎么称呼你。'
      return
    }
    if (roomMode === 'join' && !roomCode.trim()) {
      formError = '填一下朋友发来的房间号。'
      return
    }
    joining = true
    try {
      let id = roomCode.trim()
      if (roomMode === 'create') {
        const rules = stacking
          ? [
              { name: 'matching' },
              { name: 'actions' },
              { name: 'draw' },
              { name: 'challenge' },
              { name: 'stacking' },
            ]
          : undefined
        id = (await api.create(rules)).id
        roomCode = id
      }
      const result = await api.join(id, name)
      const session: Session = {
        roomId: id,
        token: result.token,
        playerId: result.player_id,
      }
      if (!alive) return
      attach(new OnlineTransport(api, session, result.room))
      const saved = saveSession(session)
      savedSession = session
      panel = ''
      history.replaceState(null, '', location.pathname)
      showNotice(
        saved
          ? '已经入座，邀请朋友一起玩吧。'
          : '已经入座；当前浏览器无法保存会话，刷新前请留在本页。',
      )
    } catch (error) {
      if (alive) formError = errorMessage(error)
    } finally {
      joining = false
    }
  }
  async function invite(codeOnly = false) {
    const text = codeOnly
      ? room.id
      : `${location.origin}${location.pathname}?room=${encodeURIComponent(room.id)}`
    try {
      await navigator.clipboard.writeText(text)
      showNotice(codeOnly ? '房间号已复制。' : '邀请链接已复制，发给朋友就好。')
    } catch {
      showNotice(`房间号：${room.id}，可在房间面板中选中复制。`)
    }
  }
  function resetDemo(scenario: 'normal' | 'uno' = 'normal') {
    attach(new DemoTransport(scenario))
    panel = ''
    showNotice(
      scenario === 'uno'
        ? '体验 UNO：先打出一张红牌，然后按空格或点中央。'
        : '新的一局，祝你手气不错。',
    )
  }

  function resumeSaved() {
    const session = savedSession
    if (!session) return
    const initialPort = port
    panel = ''
    void restoreRoomSession(api, session, {
      isCurrent: () => alive && port === initialPort && !joining,
      restored: (restored) => {
        attach(new OnlineTransport(api, session, restored))
        showNotice('欢迎回来，牌局还在。')
      },
      forget: () => {
        saveSession(null)
        savedSession = null
      },
      failed: (error) => showNotice(errorMessage(error)),
    })
  }

  onMount(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    systemReduced = media.matches
    const onPreference = () => {
      systemReduced = media.matches
    }
    media.addEventListener('change', onPreference)
    const ticker = setInterval(() => {
      now = Date.now()
    }, 50)
    const invitation = new URLSearchParams(location.search).get('room')
    if (invitation) {
      roomMode = 'join'
      roomCode = invitation
    }
    savedSession = readSession()
    const session = sessionForInvitation(savedSession, invitation)
    if (session) {
      const initialPort = port
      void restoreRoomSession(api, session, {
        isCurrent: () => alive && port === initialPort && !joining,
        restored: (restored) => {
          attach(new OnlineTransport(api, session, restored))
          history.replaceState(null, '', location.pathname)
          showNotice('欢迎回来，牌局还在。')
        },
        forget: () => {
          saveSession(null)
          savedSession = null
        },
        failed: (error) => {
          if (
            invitation &&
            error instanceof ApiError &&
            [401, 404].includes(error.status)
          )
            panel = 'room'
          showNotice('上次房间暂时无法恢复，你可以稍后刷新，或重新加入。')
        },
      })
    } else if (invitation) {
      panel = 'room'
    }
    return () => {
      clearInterval(ticker)
      media.removeEventListener('change', onPreference)
    }
  })
  onDestroy(() => {
    alive = false
    unsubscribe()
    port.dispose()
    clearTimeout(noticeTimer)
  })
</script>

<svelte:window onkeydown={onKey} />

<div class="app-shell" class:gentle={reduced}>
  <header class="app-header">
    <a class="brand" href={location.pathname} aria-label="UNOur 首页"
      ><span class="brand-cards" aria-hidden="true"
        ><i></i><i></i><i></i><i></i></span
      ><span>UNOur<span class="brand-period">.</span></span></a
    >
    <span class="brand-note">好朋友，来一局。</span>
    <div class="header-right">
      <span
        class="connection-badge"
        class:offline={connection === 'reconnecting'}
        ><i></i>{connection === 'demo'
          ? '试玩牌桌'
          : connection === 'connected'
            ? '已连接'
            : '正在重连'}</span
      ><button
        class="icon-button header-settings"
        aria-label="打开偏好设置"
        onclick={() => {
          panel = 'settings'
        }}><Icon name="settings" /></button
      >
    </div>
  </header>
  <main class="game-layout">
    <section class="game-panel" aria-label="UNOur 游戏">
      <div class="room-heading">
        <div>
          <div class="eyebrow">
            <span class="tiny-leaf"><Icon name="leaf" size={12} /></span>A
            LITTLE GOOD TIME
          </div>
          <h1>
            {mode === 'demo' ? '周末小牌局' : '朋友们的牌局'}<span
              class="room-tag"
              >{mode === 'demo'
                ? '试玩'
                : `${room.state.players.length} 人`}</span
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
              formError = ''
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
              ? '朋友到齐，就可以开始'
              : room.state.phase === 'finished'
                ? '这一局，玩得开心'
                : myTurn
                  ? '轮到你出牌'
                  : `等${turnPlayer?.name || '朋友'}出牌`}</strong
          ><span
            >{room.state.phase === 'lobby'
              ? `房间内 ${room.state.players.length} 位玩家`
              : room.state.phase === 'finished'
                ? '也许下一局，运气还会更好'
                : myTurn
                  ? room.state.can_pass
                    ? '可以打出刚摸到的牌，或跳过'
                    : room.state.pending_draw
                      ? `承受 ${room.state.pending_draw} 张罚牌，或按规则接牌`
                      : `出${colorNames[room.state.active_color || 'red']}、相同牌面，或万能牌`
                  : '看看手牌，提前想好下一步'}</span
          >
        </div>
        <span class="turn-side"
          >{room.state.phase === 'playing' ? 'YOUR TABLE' : 'TAKE A SEAT'}</span
        >
      </div>
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
      <div class="action-bar">
        {#if room.state.phase === 'lobby'}
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
                ? '开始这一局'
                : '等待房主开局'}<Icon name="arrow" size={18} /></button
          >
        {:else if room.state.phase === 'finished'}
          <button
            class="button secondary"
            onclick={() => {
              panel = 'room'
            }}
            ><Icon name="users" size={17} />{mode === 'online'
              ? '房间信息'
              : '和朋友开一桌'}</button
          ><button class="button primary" onclick={() => resetDemo()}
            >再试玩一局<Icon name="arrow" size={18} /></button
          >
        {:else}
          <button
            class="button secondary draw-button"
            disabled={!myTurn || busy}
            onclick={() =>
              room.state.can_pass ? void run('pass') : void run('draw')}
            ><Icon
              name={room.state.can_pass ? 'arrow' : 'plus'}
              size={19}
            />{room.state.can_pass
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
                ? '稍等，快到你了'
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
        ><span>牌局有输赢，快乐不分胜负。</span>
      </div>
    </section>
    <SideRail
      {room}
      {mode}
      {activities}
      {invite}
      {showNotice}
      openRoom={() => {
        panel = 'room'
      }}
      openRules={() => {
        panel = 'rules'
      }}
    />
  </main>
  <footer class="desktop-footer">
    <span>UNOur · 为相聚，留一张牌桌。</span><button
      class="text-button"
      onclick={() => {
        panel = 'rules'
      }}>怎么玩？<Icon name="arrow" size={13} /></button
    >
  </footer>
  <output class="notice" class:visible={noticeVisible} aria-live="polite"
    ><span class="notice-icon"><Icon name="info" size={16} /></span
    >{notice}</output
  >

  <Sheet
    open={!!panel}
    title={panelTitle}
    description={panel === 'room'
      ? mode === 'demo'
        ? '建一间小房间，邀请熟悉的人一起玩。'
        : '把房间号或邀请链接发给朋友，就能一起玩。'
      : panel === 'color'
        ? '选一个颜色，交给下一位朋友。'
        : ''}
    {reduced}
    onclose={() => {
      if (!joining) panel = ''
    }}
  >
    {#if panel === 'color'}
      <div class="color-options">
        {#each ['red', 'yellow', 'green', 'blue'] as color}<button
            class={`color-option ${color}`}
            onclick={() => chooseColor(color as PlayColor)}
            ><span
              >{{ red: '●', yellow: '◆', green: '■', blue: '▲' }[color]}</span
            >{colorNames[color as PlayColor]}</button
          >{/each}
      </div>
    {:else if panel === 'rules'}
      <RulesPanel
        {room}
        {mode}
        onclose={() => {
          panel = ''
        }}
      />
    {:else if panel === 'settings'}
      <PreferencesPanel
        bind:quietMotion
        {systemReduced}
        {mode}
        {resetDemo}
        resumable={!!savedSession}
        onresume={resumeSaved}
      />
    {:else if panel === 'room'}
      {#if mode === 'online'}
        <div class="invite-code">
          <span>你的房间号</span><strong>{room.id}</strong><button
            class="button secondary"
            onclick={() => void invite(true)}
            ><Icon name="copy" size={16} />复制房间号</button
          >
        </div>
        <button class="button primary full" onclick={() => void invite()}
          ><Icon name="link" size={17} />复制邀请链接</button
        >
        <p class="form-tip">朋友打开链接，输入昵称就能入座。</p>
      {:else}
        <div class="segmented">
          <button
            class:chosen={roomMode === 'create'}
            aria-pressed={roomMode === 'create'}
            onclick={() => {
              roomMode = 'create'
              formError = ''
            }}>创建房间</button
          ><button
            class:chosen={roomMode === 'join'}
            aria-pressed={roomMode === 'join'}
            onclick={() => {
              roomMode = 'join'
              formError = ''
            }}>加入朋友</button
          >
        </div>
        <form onsubmit={enterRoom}>
          <label class="field"
            ><span>怎么称呼你</span><input
              bind:value={nickname}
              placeholder="给自己起个昵称"
              maxlength="24"
              autocomplete="nickname"
              enterkeyhint={roomMode === 'join' ? 'next' : 'go'}
              required
              disabled={joining}
            /></label
          >{#if roomMode === 'join'}<label class="field"
              ><span>朋友的房间号</span><input
                bind:value={roomCode}
                placeholder="粘贴朋友发来的房间号"
                maxlength="64"
                autocapitalize="none"
                autocomplete="off"
                spellcheck="false"
                enterkeyhint="go"
                required
                disabled={joining}
              /></label
            >{:else}<label class="rule-toggle"
              ><div>
                <strong>允许罚牌叠加</strong><span
                  >让 +2 接住 +2，多一点小刺激</span
                >
              </div>
              <input
                type="checkbox"
                bind:checked={stacking}
                disabled={joining}
              /></label
            >{/if}{#if formError}<p class="form-error" role="alert">
              {formError}
            </p>{/if}<button
            class="button primary full"
            type="submit"
            disabled={joining}
            >{joining
              ? '正在为你入座…'
              : roomMode === 'create'
                ? '开一桌，等朋友'
                : '加入这张牌桌'}<Icon name="arrow" size={18} /></button
          >
          <p class="form-tip">
            {roomMode === 'create'
              ? '创建后获得专属房间号，分享就能一起玩。'
              : '请准确填写房间号，字母区分大小写。'}
          </p>
        </form>
      {/if}
    {/if}
  </Sheet>
</div>
