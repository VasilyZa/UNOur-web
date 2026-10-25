<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import Icon from './lib/components/Icon.svelte'
  import Avatar from './lib/components/Avatar.svelte'
  import AuthForm from './lib/components/AuthForm.svelte'
  import AccountPanel from './lib/components/AccountPanel.svelte'
  import RoomForm from './lib/components/RoomForm.svelte'
  import GameScreen from './lib/components/GameScreen.svelte'
  import PreferencesPanel from './lib/components/PreferencesPanel.svelte'
  import Sheet from './lib/components/Sheet.svelte'
  import { AccountClient, type Account } from './lib/account/api'
  import { AccountRequests } from './lib/account/requests'
  import { ApiClient, ApiError, errorMessage } from './lib/game/api'
  import { joinFromLobby } from './lib/game/entry'
  import { readSession, saveSession, forgetSession } from './lib/game/session'
  import {
    restoreRoomSession,
    sessionForInvitation,
  } from './lib/game/bootstrap'
  import {
    applyTheme,
    readTheme,
    saveTheme,
    type ThemePreference,
  } from './lib/theme'
  import type {
    BotDifficulty,
    JoinResult,
    Room,
    Session,
  } from './lib/game/types'

  const api = new ApiClient(),
    accounts = new AccountClient()
  const abort = new AbortController()
  const accountRequests = new AccountRequests()
  const accountChangeKey = 'unour.account.change'
  let user = $state<Account | null>(null),
    panelUser = $state<Account | null>(null)
  let active = $state<{ session: Session; room: Room } | null>(null)
  let savedSession = $state<Session | null>(null)
  let checking = $state(true),
    restoring = $state(false),
    joining = $state(false),
    authenticating = $state(false),
    accountBusy = $state(false)
  let loadError = $state(''),
    roomError = $state(''),
    accountError = $state('')
  let spectate = $state(false)
  let roomCode = $state(''),
    roomMode = $state<'create' | 'join' | 'solo'>('solo'),
    stacking = $state(false),
    botCount = $state(2),
    botDifficulty = $state<BotDifficulty>('normal')
  let panel = $state<'' | 'settings' | 'account'>(''),
    retainedPanel = $state<'settings' | 'account'>('settings')
  let themePreference = $state<ThemePreference>(readTheme()),
    systemDark = $state(matchMedia('(prefers-color-scheme: dark)').matches)
  let quietMotion = $state(false),
    systemReduced = $state(false)
  let reduced = $derived(quietMotion || systemReduced)
  let alive = true,
    revision = 0,
    identityEpoch = 0
  let reconcilePending = false
  let invitation: string | null = null

  $effect(() => {
    applyTheme(themePreference, systemDark)
    saveTheme(themePreference)
  })
  $effect.pre(() => {
    if (panel) retainedPanel = panel
    if (panel === 'account' && user) panelUser = user
  })

  function setAccount(account: Account | null) {
    if (user?.id !== account?.id) {
      identityEpoch++
      accountBusy = false
      accountError = ''
      panel = ''
    }
    user = account
  }

  async function restore(session: Session) {
    if (!user || session.accountId !== user.id || restoring || joining) return
    const current = ++revision,
      accountID = user.id
    restoring = true
    await restoreRoomSession(api, session, {
      isCurrent: () =>
        alive && revision === current && user?.id === accountID && !joining,
      restored: (room) => {
        active = { session, room }
        history.replaceState(null, '', location.pathname)
      },
      forget: () => {
        forgetSession(session)
        savedSession = null
      },
      failed: (error) => {
        roomError = errorMessage(error)
        if (
          error instanceof ApiError &&
          ['account_unauthorized', 'account_changed'].includes(error.code)
        )
          loseSession(error)
      },
    })
    if (revision === current) restoring = false
  }
  async function activate(account: Account) {
    if (!alive) return
    setAccount(account)
    loadError = ''
    savedSession = readSession()
    if (savedSession && savedSession.accountId !== account.id) {
      forgetSession(savedSession)
      savedSession = null
    }
    const previous = sessionForInvitation(savedSession, invitation)
    if (previous) await restore(previous)
  }
  async function initialize() {
    if (!alive || authenticating) return
    checking = true
    loadError = ''
    try {
      await accountRequests.restore(
        () => accounts.current(abort.signal),
        (result) => activate(result.user),
      )
    } catch (error) {
      if (alive && !(error instanceof ApiError && error.status === 401))
        loadError = errorMessage(error)
    } finally {
      if (alive) checking = false
    }
  }
  async function authenticate(
    username: string,
    password: string,
    register: boolean,
  ) {
    authenticating = true
    try {
      await accountRequests.authenticate(
        () =>
          register
            ? accounts.register(username, password)
            : accounts.login(username, password),
        async (result) => {
          announceAccountChange()
          await activate(result.user)
        },
      )
    } finally {
      if (alive) {
        authenticating = false
        if (reconcilePending) {
          reconcilePending = false
          void reconcileAccount()
        }
      }
    }
  }
  function announceAccountChange() {
    try {
      localStorage.setItem(accountChangeKey, `${Date.now()}:${Math.random()}`)
    } catch {
      /* Mutation requests still verify the expected account. */
    }
  }
  async function reconcileAccount() {
    if (!alive) return
    if (authenticating) {
      reconcilePending = true
      return
    }
    try {
      await accountRequests.restore(
        () => accounts.current(abort.signal),
        async (result) => {
          if (!alive) return
          if (user?.id !== result.user.id) {
            revision++
            active = null
            restoring = false
            joining = false
            panel = ''
            await activate(result.user)
          } else setAccount(result.user)
        },
      )
    } catch (error) {
      if (alive && error instanceof ApiError && error.status === 401) {
        revision++
        active = null
        setAccount(null)
        savedSession = null
        restoring = false
        joining = false
        panel = ''
      }
    }
  }
  async function enterRoom(event: SubmitEvent) {
    event.preventDefault()
    if (!user || joining || restoring) return
    const accountID = user.id,
      current = ++revision
    joining = true
    roomError = ''
    try {
      const rules = stacking
        ? [
            { name: 'matching' },
            { name: 'actions' },
            { name: 'draw' },
            { name: 'challenge' },
            { name: 'stacking' },
          ]
        : undefined
      let result: JoinResult
      if (roomMode === 'solo') {
        result = await api.solo(accountID, botCount, botDifficulty, rules)
      } else {
        result = await joinFromLobby(
          api,
          accountID,
          { mode: roomMode, roomId: roomCode, spectate, rules },
          (id) => {
            if (!alive || user?.id !== accountID || current !== revision) return
            roomCode = id
            roomMode = 'join'
            spectate = false
          },
        )
      }
      if (!alive || user?.id !== accountID || current !== revision) return
      const session: Session = {
        roomId: result.room.id,
        token: result.token,
        playerId: result.player_id,
        accountId: accountID,
      }
      active = { session, room: result.room }
      savedSession = session
      if (!saveSession(session))
        roomError = '当前浏览器无法保存房间凭证，刷新后可重新加入。'
      invitation = null
      history.replaceState(null, '', location.pathname)
    } catch (error) {
      if (alive && current === revision) {
        roomError = errorMessage(error)
        if (
          error instanceof ApiError &&
          ['account_unauthorized', 'account_changed'].includes(error.code)
        )
          loseSession(error)
      }
    } finally {
      if (alive && current === revision) joining = false
    }
  }
  function loseSession(error: ApiError) {
    const previous = active?.session || savedSession
    if (previous) {
      roomCode = previous.roomId
      roomMode = 'join'
      forgetSession(previous)
    }
    revision++
    active = null
    savedSession = null
    restoring = false
    joining = false
    roomError = errorMessage(error)
    if (
      ['account_unauthorized', 'account_changed', 'unauthorized'].includes(
        error.code,
      )
    ) {
      accountRequests.invalidate()
      setAccount(null)
      checking = false
      void reconcileAccount()
    }
  }
  async function accountAction(
    action: 'upload' | 'reset' | 'logout',
    file?: File,
  ) {
    if (!user || panel !== 'account' || accountBusy || joining) return
    accountError = ''
    if (
      action === 'upload' &&
      (!file ||
        file.size > 2 * 1024 * 1024 ||
        !['image/png', 'image/jpeg'].includes(file.type))
    ) {
      accountError = '请选择不超过 2 MiB 的 PNG 或 JPEG 图片。'
      return
    }
    accountBusy = true
    const accountID = user.id,
      epoch = identityEpoch
    const isCurrent = () =>
      alive && identityEpoch === epoch && user?.id === accountID
    try {
      if (action === 'logout') {
        await accounts.logout(accountID)
        if (!isCurrent()) return
        accountRequests.invalidate()
        if (savedSession) forgetSession(savedSession)
        revision++
        active = null
        setAccount(null)
        savedSession = null
        restoring = false
        roomError = ''
        panel = ''
        checking = false
        announceAccountChange()
      } else {
        const result =
          action === 'upload'
            ? await accounts.upload(file!, accountID)
            : await accounts.resetAvatar(accountID)
        if (isCurrent()) {
          setAccount(result.user)
          announceAccountChange()
        }
      }
    } catch (error) {
      if (!isCurrent()) return
      accountError = errorMessage(error)
      if (
        error instanceof ApiError &&
        ['account_unauthorized', 'account_changed'].includes(error.code)
      ) {
        loseSession(error)
        panel = ''
      }
    } finally {
      if (isCurrent()) accountBusy = false
    }
  }
  onMount(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)'),
      appearance = matchMedia('(prefers-color-scheme: dark)')
    const updateMotion = () => {
        systemReduced = motion.matches
      },
      updateAppearance = () => {
        systemDark = appearance.matches
      }
    updateMotion()
    updateAppearance()
    motion.addEventListener('change', updateMotion)
    appearance.addEventListener('change', updateAppearance)
    const onStorage = (event: StorageEvent) => {
      if (event.key === accountChangeKey) void reconcileAccount()
    }
    const onVisibility = () => {
      if (!document.hidden) void reconcileAccount()
    }
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisibility)
    spectate = new URLSearchParams(location.search).get('watch') === '1'
    invitation = new URLSearchParams(location.search).get('room')
    if (invitation) {
      roomCode = invitation
      roomMode = 'join'
    }
    void initialize()
    return () => {
      motion.removeEventListener('change', updateMotion)
      appearance.removeEventListener('change', updateAppearance)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  })
  onDestroy(() => {
    alive = false
    revision++
    accountRequests.invalidate()
    abort.abort()
  })
</script>

<div class="app-shell" class:gentle={reduced}>
  <header class="app-header">
    <a class="brand" href={location.pathname} aria-label="UNOur 首页"
      ><span class="brand-cards" aria-hidden="true"
        ><i></i><i></i><i></i><i></i></span
      ><span>UNOur<span class="brand-period">.</span></span></a
    >
    <span class="brand-note">UNO 牌桌</span>
    <div class="header-right">
      {#if user}<span class="connection-badge"><i></i>已登录</span><button
          class="icon-button account-button"
          aria-label="打开账户"
          disabled={joining}
          onclick={() => {
            panel = 'account'
            accountError = ''
          }}><Avatar src={user.avatar_url} size={30} /></button
        >{/if}
      <button
        class="icon-button header-settings"
        aria-label="打开偏好设置"
        onclick={() => {
          panel = 'settings'
        }}><Icon name="settings" /></button
      >
    </div>
  </header>
  {#if checking}
    <main class="entry-layout">
      <div class="entry-card loading-state" role="status">
        <Icon name="cards" size={28} />
        <p>正在连接…</p>
      </div>
    </main>
  {:else if !user}
    <main class="entry-layout">
      <section class="entry-card" aria-label="账户登录">
        {#if loadError}<p class="form-error" role="alert">{loadError}</p>
          <button
            class="text-button retry-connection"
            disabled={authenticating}
            onclick={() => void initialize()}>重新连接</button
          >{/if}
        <AuthForm onauthenticate={authenticate} />
      </section>
    </main>
  {:else if active}
    {#key active.session.token}<GameScreen
        {api}
        session={active.session}
        initialRoom={active.room}
        {reduced}
        onleave={() => {
          if (active) forgetSession(active.session)
          savedSession = null
          revision++
          active = null
          invitation = null
        }}
        onSessionLost={loseSession}
      />{/key}
  {:else}
    <main class="entry-layout">
      <section class="entry-card" aria-label="房间大厅">
        <div class="entry-heading">
          <span class="entry-icon"><Icon name="cards" size={24} /></span>
          <h1>开始一局</h1>
        </div>
        <p class="entry-account">
          <Avatar src={user.avatar_url} size={24} /><span>{user.username}</span>
        </p>
        {#if restoring}<p class="loading-state" role="status">
            正在恢复牌局…
          </p>{:else}
          <RoomForm
            bind:code={roomCode}
            bind:mode={roomMode}
            bind:spectate
            bind:stacking
            bind:botCount
            bind:difficulty={botDifficulty}
            busy={joining}
            error={roomError}
            onsubmit={enterRoom}
          />
          {#if savedSession}<button
              class="text-button resume-room"
              disabled={joining}
              onclick={() => void restore(savedSession!)}
              >返回上次房间<Icon name="arrow" size={15} /></button
            >{/if}
        {/if}
      </section>
    </main>
  {/if}
  <Sheet
    open={!!panel}
    title={retainedPanel === 'account' ? '账户' : '偏好设置'}
    {reduced}
    onclose={() => {
      if (!accountBusy) panel = ''
    }}
  >
    {#if retainedPanel === 'account' && panelUser}<AccountPanel
        user={panelUser}
        busy={accountBusy}
        error={accountError}
        onupload={(file) => void accountAction('upload', file)}
        onreset={() => void accountAction('reset')}
        onlogout={() => void accountAction('logout')}
      />
    {:else}<PreferencesPanel
        bind:quietMotion
        bind:themePreference
        {systemReduced}
      />{/if}
  </Sheet>
</div>
