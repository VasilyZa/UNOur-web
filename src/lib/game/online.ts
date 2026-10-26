import { ApiError } from './api'
import type {
  Action,
  ActionBody,
  GameTransport,
  GameClient,
  Room,
  Session,
  Snapshot,
} from './types'

/** 传输层独占轮询生命周期；命令不会因网络失败自动重试。 */
export class OnlineTransport implements GameTransport {
  private listeners = new Set<(snapshot: Snapshot) => void>()
  private timer?: ReturnType<typeof setTimeout>
  private abort = new AbortController()
  private disposed = false
  private writing = false
  private polling = false
  private connection: Snapshot['connection'] = 'connected'
  private api: Pick<GameClient, 'read' | 'action' | 'terminalErrorCodes'>
  private session: Session
  private room: Room
  private onSessionLost?: (error: ApiError) => void

  constructor(
    api: Pick<GameClient, 'read' | 'action' | 'terminalErrorCodes'>,
    session: Session,
    room: Room,
    onSessionLost?: (error: ApiError) => void,
  ) {
    this.api = api
    this.session = session
    this.room = room
    this.onSessionLost = onSessionLost
  }

  private sessionEnded(error: unknown): error is ApiError {
    return (
      error instanceof ApiError &&
      ([401, 404].includes(error.status) ||
        !!this.api.terminalErrorCodes?.includes(error.code))
    )
  }

  subscribe(listener: (snapshot: Snapshot) => void): () => void {
    this.listeners.add(listener)
    listener({ room: this.room, connection: this.connection })
    if (this.listeners.size === 1) this.schedule()
    return () => this.listeners.delete(listener)
  }

  private publish(room: Room, connection: Snapshot['connection']): void {
    if (
      this.disposed ||
      (room.revision ?? room.state.version) <
        (this.room.revision ?? this.room.state.version)
    )
      return
    const changed =
      (room.revision ?? room.state.version) !==
        (this.room.revision ?? this.room.state.version) ||
      connection !== this.connection ||
      room.state.players.some(
        (player) =>
          room.profiles?.[player.id]?.avatar_url !==
          this.room.profiles?.[player.id]?.avatar_url,
      )
    this.room = room
    this.connection = connection
    if (changed)
      this.listeners.forEach((listener) => listener({ room, connection }))
  }

  private schedule(): void {
    clearTimeout(this.timer)
    if (!this.disposed)
      this.timer = setTimeout(
        () => void this.poll(),
        this.connection === 'reconnecting' ? 2500 : 900,
      )
  }

  private async poll(): Promise<void> {
    if (this.disposed) return
    if (
      this.writing ||
      this.polling ||
      (globalThis as { document?: { hidden: boolean } }).document?.hidden
    ) {
      this.schedule()
      return
    }
    this.polling = true
    try {
      this.publish(
        await this.api.read(this.session, this.abort.signal),
        'connected',
      )
    } catch (error) {
      if (this.disposed) return
      if (this.sessionEnded(error)) {
        this.dispose()
        this.onSessionLost?.(error)
      } else this.publish(this.room, 'reconnecting')
    } finally {
      this.polling = false
      this.schedule()
    }
  }

  async act(action: Action, body: ActionBody = {}): Promise<void> {
    if (this.disposed) return
    const independent = action === 'uno' || action === 'uno-penalty'
    if (this.writing && !independent)
      throw new ApiError('action_in_progress', '上一项操作还在确认中。')
    if (!independent) this.writing = true
    try {
      const command =
        independent || action === 'rematch' || action === 'participation'
          ? body
          : { ...body, expected_version: this.room.state.version }
      const response = await this.api.action(
        this.session,
        action,
        command,
        this.abort.signal,
      )
      this.publish(response.room, 'connected')
    } catch (error) {
      if (this.disposed) throw error
      if (this.sessionEnded(error)) {
        this.dispose()
        this.onSessionLost?.(error)
      }
      // 先同步再让玩家决定，禁止盲目重发可能已经提交的摸牌/出牌。
      if (!this.disposed) {
        try {
          this.publish(
            await this.api.read(this.session, this.abort.signal),
            'connected',
          )
        } catch {
          this.publish(this.room, 'reconnecting')
        }
      }
      throw error
    } finally {
      if (!independent) this.writing = false
    }
  }

  dispose(): void {
    this.disposed = true
    clearTimeout(this.timer)
    this.abort.abort()
    this.listeners.clear()
  }
}
