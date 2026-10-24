import { ApiError } from '../http'

/** Account reads and credential changes share a lifecycle. A late read cannot
 * restore the identity that was present before a newer login or logout. */
export class AccountRequests {
  private revision = 0
  private authenticating = false

  async restore<T>(
    load: () => Promise<T>,
    apply: (value: T) => void | Promise<void>,
  ): Promise<void> {
    if (this.authenticating) return
    const revision = ++this.revision
    try {
      const result = await load()
      if (revision === this.revision) await apply(result)
    } catch (error) {
      if (revision === this.revision) throw error
    }
  }

  async authenticate<T>(
    load: () => Promise<T>,
    apply: (value: T) => void | Promise<void>,
  ): Promise<void> {
    if (this.authenticating) throw new ApiError('auth_busy', '登录正在确认中。')
    this.authenticating = true
    const revision = ++this.revision
    try {
      const result = await load()
      if (revision === this.revision) await apply(result)
    } catch (error) {
      if (revision === this.revision) throw error
    } finally {
      if (revision === this.revision) this.authenticating = false
    }
  }

  invalidate(): void {
    this.revision++
    this.authenticating = false
  }
}
