import { describe, expect, it, vi } from 'vitest'
import { DialogMotion } from './dialog'

function fixture() {
  const pending: { finish: () => void; animation: Animation }[] = []
  const dialog = {
    open: false,
    inert: false,
    showModal: vi.fn(() => {
      dialog.open = true
    }),
    close: vi.fn(() => {
      dialog.open = false
    }),
    animate: vi.fn(
      (_frames: Keyframe[], _options: KeyframeAnimationOptions) => {
        let finish!: () => void
        const finished = new Promise<Animation>((resolve) => {
          finish = () => resolve(animation)
        })
        const animation = { finished, cancel: vi.fn() } as unknown as Animation
        pending.push({ finish, animation })
        return animation
      },
    ),
  }
  const style = { opacity: '.45', transform: 'matrix(1, 0, 0, 1, 0, 7)' }
  const motion = new DialogMotion(
    dialog as unknown as HTMLDialogElement,
    () => style,
  )
  return { dialog, pending, motion, style }
}

describe('可中断的弹窗动效', () => {
  it('退出开始即停用交互，重新打开时恢复', () => {
    const { dialog, motion } = fixture()
    motion.transition(true, false)
    expect(dialog.inert).toBe(false)
    motion.transition(false, false)
    expect(dialog.open).toBe(true)
    expect(dialog.inert).toBe(true)
    motion.transition(true, false)
    expect(dialog.inert).toBe(false)
  })

  it('退出期间重开，迟到的退出完成不能关闭新面板', async () => {
    const { dialog, pending, motion } = fixture()
    motion.transition(true, false)
    motion.transition(false, false)
    const closing = pending.at(-1)!
    motion.transition(true, false)
    closing.finish()
    await Promise.resolve()
    expect(dialog.open).toBe(true)
    expect(dialog.close).not.toHaveBeenCalled()
    expect(closing.animation.cancel).toHaveBeenCalled()
  })

  it('切换方向从当前位置继续，而不是跳回起点', () => {
    const { dialog, motion, style } = fixture()
    motion.transition(true, false)
    motion.transition(false, false)
    expect(dialog.animate.mock.calls.at(-1)?.[0]).toEqual([
      { opacity: Number(style.opacity), transform: style.transform },
      { opacity: 0, transform: 'translateY(16px) scale(.97)' },
    ])
  })

  it('正常退出完成后关闭，销毁后迟到回调无副作用', async () => {
    const { dialog, pending, motion } = fixture()
    motion.transition(true, false)
    motion.transition(false, true)
    pending.at(-1)!.finish()
    await Promise.resolve()
    expect(dialog.open).toBe(false)
    motion.transition(true, false)
    motion.dispose()
    const calls = dialog.close.mock.calls.length
    pending.at(-1)!.finish()
    await Promise.resolve()
    expect(dialog.close).toHaveBeenCalledTimes(calls)
  })
})
