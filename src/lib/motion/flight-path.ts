export interface CardPose {
  x: number
  y: number
  width: number
  height: number
  angle: number
}

export function poseTransform(
  pose: CardPose,
  width: number,
  height: number,
): string {
  return `translate(${pose.x - width / 2}px, ${pose.y - height / 2}px) rotate(${pose.angle}deg) scale(${pose.width / width}, ${pose.height / height})`
}

/** Sample one continuous arc; the first and last frames retain the real card pose. */
export function flightFrames(from: CardPose, to: CardPose): Keyframe[] {
  const dx = to.x - from.x,
    dy = to.y - from.y
  const distance = Math.hypot(dx, dy)
  const bend = Math.min(48, distance * 0.12)
  const controlX = (from.x + to.x) / 2 - (dy / (distance || 1)) * bend
  const controlY = (from.y + to.y) / 2 + (dx / (distance || 1)) * bend
  const angle = ((to.angle - from.angle + 540) % 360) - 180
  return Array.from({ length: 25 }, (_, index) => {
    const t = index / 24,
      u = 1 - t
    return {
      offset: t,
      opacity: 1,
      transform: poseTransform(
        {
          x: u * u * from.x + 2 * u * t * controlX + t * t * to.x,
          y: u * u * from.y + 2 * u * t * controlY + t * t * to.y,
          width: from.width + (to.width - from.width) * t,
          height: from.height + (to.height - from.height) * t,
          angle: from.angle + angle * t,
        },
        to.width,
        to.height,
      ),
    }
  })
}
