interface Feedback {
  value: string | number
  reduced: boolean
  kind?: 'count' | 'direction' | 'state'
}

/** Short, replaceable feedback for confirmed changes, never initial values. */
export function changeFeedback(node: HTMLElement, initial: Feedback) {
  let previous = initial
  let animation: Animation | undefined
  return {
    update(next: Feedback) {
      const changed = previous.value !== next.value
      const preferenceChanged = previous.reduced !== next.reduced
      previous = next
      if (!changed && !preferenceChanged) return
      const interrupted =
        animation?.playState === 'running' ? getComputedStyle(node) : undefined
      const opacity = interrupted ? Number(interrupted.opacity) : 0.5
      const currentTransform = interrupted?.transform
      animation?.cancel()
      if (!changed || document.hidden) return
      const gentle =
        next.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches
      const transform = gentle
        ? 'none'
        : (currentTransform ??
          (next.kind === 'direction'
            ? 'rotate(-90deg)'
            : next.kind === 'count'
              ? 'scale(1.08)'
              : 'scale(.97)'))
      animation = node.animate(
        [
          { opacity, transform },
          { opacity: 1, transform: 'none' },
        ],
        {
          duration: gentle ? 120 : next.kind === 'direction' ? 200 : 160,
          easing: getComputedStyle(node).getPropertyValue('--ease-out').trim(),
        },
      )
    },
    destroy() {
      animation?.cancel()
    },
  }
}

/** A rare result entrance; the static final state is always the underlying DOM. */
export function resultEntrance(node: HTMLElement, reduced: boolean) {
  const animations = [...node.children].map((child, index) => {
    const gentle =
      reduced || matchMedia('(prefers-reduced-motion: reduce)').matches
    return child.animate(
      [
        {
          opacity: 0,
          transform: gentle ? 'none' : 'translateY(8px) scale(.97)',
        },
        { opacity: 1, transform: 'none' },
      ],
      {
        duration: gentle ? 120 : 200,
        delay: gentle ? 0 : Math.min(index, 2) * 40,
        easing: getComputedStyle(node).getPropertyValue('--ease-out').trim(),
        fill: 'backwards',
      },
    )
  })
  const cancel = () => animations.forEach((animation) => animation.cancel())
  return {
    update() {
      cancel()
    },
    destroy: cancel,
  }
}
