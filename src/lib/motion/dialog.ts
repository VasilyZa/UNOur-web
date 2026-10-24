const easing = 'cubic-bezier(0.23, 1, 0.32, 1)'
const hiddenTransform = 'translateY(16px) scale(.97)'

/** 把当前视觉状态接入下一次过渡，旧完成回调不能关闭重新打开的面板。 */
export class DialogMotion {
  private animation?: Animation
  private revision = 0

  constructor(
    private dialog: HTMLDialogElement,
    private readStyle: (
      dialog: HTMLDialogElement,
    ) => Pick<CSSStyleDeclaration, 'opacity' | 'transform'> = (element) =>
      getComputedStyle(element),
  ) {}

  transition(visible: boolean, reduced: boolean): void {
    this.dialog.inert = !visible
    if (!this.dialog.open && !visible) return
    if (visible && this.dialog.open && !this.animation) return
    const wasOpen = this.dialog.open
    const style = wasOpen
      ? this.readStyle(this.dialog)
      : { opacity: '0', transform: hiddenTransform }
    const start = {
      opacity: Number(style.opacity),
      transform: reduced ? 'none' : style.transform,
    }
    const revision = ++this.revision
    this.animation?.cancel()
    if (visible && !wasOpen) this.dialog.showModal()
    const animation = this.dialog.animate(
      [
        start,
        {
          opacity: visible ? 1 : 0,
          transform: visible || reduced ? 'none' : hiddenTransform,
        },
      ],
      { duration: reduced ? 120 : visible ? 250 : 200, easing, fill: 'both' },
    )
    this.animation = animation
    animation.finished
      .then(() => {
        if (revision !== this.revision) return
        if (!visible) this.dialog.close()
        animation.cancel()
        this.animation = undefined
      })
      .catch(() => {})
  }

  dispose(): void {
    this.revision++
    this.animation?.cancel()
    this.dialog.inert = true
    if (this.dialog.open) this.dialog.close()
  }
}
