import { ApiError, errorMessage } from '../lib/http'

/** One in-flight request, ordered updates, and polling that stops on unmount. */
export class LiveResource<T> {
  data = $state<T | null>(null)
  error = $state('')
  loading = $state(false)
  private active = false
  private disposed = false
  private sequence = 0
  private abort?: AbortController
  private timer?: ReturnType<typeof setTimeout>
  constructor(
    private load: (signal: AbortSignal) => Promise<T>,
    private onerror: (error: unknown) => void,
    private interval = 5000,
  ) {}
  start() {
    if (this.disposed) return
    this.active = true
    void this.refresh()
  }
  dispose() {
    this.stop()
    this.disposed = true
    this.data = null
  }
  stop() {
    this.active = false
    this.sequence++
    this.abort?.abort()
    clearTimeout(this.timer)
    this.loading = false
  }
  accept(data: T) {
    if (this.disposed) return
    this.sequence++
    this.abort?.abort()
    this.data = data
    this.error = ''
    this.loading = false
    this.schedule()
  }
  private schedule() {
    clearTimeout(this.timer)
    if (this.active)
      this.timer = setTimeout(() => {
        void this.refresh()
      }, this.interval)
  }
  async refresh() {
    if (this.disposed) return
    clearTimeout(this.timer)
    const sequence = ++this.sequence
    this.abort?.abort()
    const abort = new AbortController()
    this.abort = abort
    if (document.hidden) {
      this.schedule()
      return
    }
    this.loading = true
    try {
      const result = await this.load(abort.signal)
      if (sequence !== this.sequence || abort.signal.aborted) return
      this.data = result
      this.error = ''
    } catch (error) {
      if (sequence !== this.sequence || abort.signal.aborted) return
      this.error = errorMessage(error)
      if (error instanceof ApiError && error.status === 404) this.data = null
      this.onerror(error)
    } finally {
      if (sequence === this.sequence) {
        this.loading = false
        this.schedule()
      }
    }
  }
}
