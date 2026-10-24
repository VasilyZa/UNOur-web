import type {
  Action,
  ActionBody,
  BotDifficulty,
  JoinResult,
  Room,
  RuleSpec,
  Session,
} from './types'

import { HttpClient } from '../http'
export { ApiError, errorMessage } from '../http'

export class ApiClient extends HttpClient {
  create(accountId: string, rules?: RuleSpec[]): Promise<Room> {
    return this.request(
      '/rooms',
      'POST',
      rules ? { rules } : {},
      undefined,
      undefined,
      accountId,
    )
  }

  solo(
    accountId: string,
    botCount: number,
    difficulty: BotDifficulty,
    rules?: RuleSpec[],
  ): Promise<JoinResult> {
    return this.request(
      '/solo',
      'POST',
      {
        bot_count: botCount,
        difficulty,
        ...(rules ? { rules } : {}),
      },
      undefined,
      undefined,
      accountId,
    )
  }

  join(roomId: string, accountId: string): Promise<JoinResult> {
    return this.request(
      `/rooms/${encodeURIComponent(roomId)}/players`,
      'POST',
      {},
      undefined,
      undefined,
      accountId,
    )
  }

  read(session: Session, signal?: AbortSignal): Promise<Room> {
    return this.request(
      `/rooms/${encodeURIComponent(session.roomId)}`,
      'GET',
      undefined,
      session.token,
      signal,
      session.accountId,
    )
  }

  action(
    session: Session,
    action: Action,
    body: ActionBody = {},
    signal?: AbortSignal,
  ): Promise<{ room: Room }> {
    return this.request(
      `/rooms/${encodeURIComponent(session.roomId)}/${action}`,
      'POST',
      body,
      session.token,
      signal,
      session.accountId,
    )
  }
}
