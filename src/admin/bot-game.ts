import { ApiError } from '../lib/http'
import type {
  Action,
  ActionBody,
  GameClient,
  Room,
  Session,
} from '../lib/game/types'
import type { AdminClient } from './api'
import type { BotControlReference, BotControlSession } from './types'

/** Adapts a private administrator lease to the ordinary game screen protocol.
 * No player token is minted or sent to the normal account/room endpoints. */
export class BotGameConnection implements GameClient {
  readonly terminalErrorCodes = ['bot_control_lost']
  readonly session: Session
  private ref: BotControlReference
  private renewAfter = Date.now() + 10000
  private renewing?: Promise<void>
  private releasing?: Promise<void>
  private closed = false
  private client: AdminClient

  constructor(client: AdminClient, control: BotControlSession) {
    this.client = client
    this.ref = {
      roomId: control.room.id,
      playerId: control.room.state.you,
      leaseId: control.lease_id,
    }
    this.session = {
      roomId: this.ref.roomId,
      playerId: this.ref.playerId,
      accountId: '',
      token: '',
    }
  }

  private async heartbeat(signal?: AbortSignal): Promise<void> {
    if (this.closed)
      throw new ApiError(
        'bot_control_lost',
        '此 Bot 的操作已结束，请返回房间管理。',
        409,
      )
    if (Date.now() < this.renewAfter) return
    this.renewing ??= this.client
      .renewBot(this.ref, signal)
      .then(() => {
        this.renewAfter = Date.now() + 10000
      })
      .finally(() => {
        this.renewing = undefined
      })
    await this.renewing
  }

  async read(_session: Session, signal?: AbortSignal): Promise<Room> {
    await this.heartbeat(signal)
    return (await this.client.readBot(this.ref, signal)).room
  }

  async action(
    _session: Session,
    action: Action,
    body: ActionBody = {},
    signal?: AbortSignal,
  ): Promise<{ room: Room }> {
    if (
      !['play', 'draw', 'pass', 'challenge', 'uno', 'uno-penalty'].includes(
        action,
      )
    )
      throw new ApiError('forbidden', '电脑席位不支持此操作。', 403)
    await this.heartbeat(signal)
    return this.client.botAction(this.ref, action, body, signal)
  }

  async leave(_session: Session): Promise<void> {
    if (this.closed) return
    this.releasing ??= this.client
      .releaseBot(this.ref)
      .catch((error) => {
        if (!(error instanceof ApiError && error.code === 'bot_control_lost'))
          throw error
      })
      .then(() => {
        this.closed = true
      })
      .finally(() => {
        this.releasing = undefined
      })
    await this.releasing
  }

  dissolve(session: Session): Promise<void> {
    return this.leave(session)
  }
}
