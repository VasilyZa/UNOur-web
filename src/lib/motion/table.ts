import type { Room } from '../game/types'
import { flightFrames, poseTransform, type CardPose } from './flight-path'

export interface CardTransfer {
  kind: 'play' | 'draw'
  player: string
  card?: number
}

/** Only consecutive, confirmed snapshots can describe a physical card path. */
export function cardTransfers(before: Room, after: Room): CardTransfer[] {
  if (
    before.id !== after.id ||
    before.state.you !== after.state.you ||
    (before.round ?? 1) !== (after.round ?? 1) ||
    before.state.phase !== 'playing' ||
    after.state.phase !== 'playing' ||
    after.state.version !== before.state.version + 1
  )
    return []
  const transfers: CardTransfer[] = []
  const known = new Map(
    before.state.players.map((player) => [player.id, player]),
  )
  const top = after.state.top_card
  const actor = known.get(before.state.turn ?? '')
  const nextActor = after.state.players.find(
    (player) => player.id === actor?.id,
  )
  if (
    top &&
    top.id !== before.state.top_card?.id &&
    actor &&
    nextActor &&
    actor.hand_count === nextActor.hand_count + 1
  )
    transfers.push({ kind: 'play', player: actor.id, card: top.id })

  for (const player of after.state.players) {
    const previous = known.get(player.id)
    if (!previous || player.hand_count <= previous.hand_count) continue
    if (player.id === after.state.you) {
      const oldCards = new Set(previous.hand?.map((card) => card.id))
      for (const card of (player.hand ?? [])
        .filter((card) => !oldCards.has(card.id))
        .slice(0, 3))
        transfers.push({ kind: 'draw', player: player.id, card: card.id })
    } else {
      // Other players' hands never supply an animation face or a card ID.
      for (
        let i = 0;
        i < Math.min(3, player.hand_count - previous.hand_count);
        i++
      )
        transfers.push({ kind: 'draw', player: player.id })
    }
  }
  return transfers
}

interface Flight {
  transfer: CardTransfer
  origin: CardPose
  previousFace?: Element
  previousPose?: CardPose
}

interface ActiveFlight {
  hand: boolean
  landing: HTMLElement | null
  settle: () => void
}

/** Owns only decorative cards; game state and available actions update immediately. */
export class TableMotion {
  private revision = 0
  private flights = new Set<ActiveFlight>()
  private events = new AbortController()
  private skipNext = false
  private layer?: HTMLElement

  constructor(private surface: HTMLElement) {
    const options = { signal: this.events.signal }
    window.addEventListener('resize', () => this.clear(), options)
    window.addEventListener('scroll', () => this.clear(), options)
    surface.addEventListener(
      'scroll',
      (event) => {
        if ((event.target as Element).closest('.hand-section'))
          this.settleHands()
        else this.clear()
      },
      { ...options, capture: true },
    )
    surface.addEventListener(
      'pointerdown',
      (event) => {
        // Choosing a card can move the hand. UNO and other controls must not stop a play.
        if ((event.target as Element).closest('.hand-section'))
          this.settleHands()
      },
      options,
    )
    document.addEventListener(
      'visibilitychange',
      () => {
        this.skipNext = true
        this.clear()
      },
      options,
    )
  }

  private player(id: string): HTMLElement | undefined {
    return (
      [...this.surface.querySelectorAll<HTMLElement>('[data-motion-player]')]
        .find((node) => node.dataset.motionPlayer === id)
        ?.querySelector<HTMLElement>('.avatar-wrap') ?? undefined
    )
  }

  private handCard(id?: number): HTMLElement | null {
    return this.surface.querySelector(`[data-card-id="${id}"] .hand-visual`)
  }

  private pose(node: Element | null | undefined): CardPose | undefined {
    if (!node) return
    const rect = node.getBoundingClientRect()
    const viewport = node
      .closest('.hand-scroll, .opponents-viewport')
      ?.getBoundingClientRect()
    if (
      rect.width < 1 ||
      rect.height < 1 ||
      rect.bottom <= 0 ||
      rect.top >= innerHeight ||
      rect.right <= 0 ||
      rect.left >= innerWidth ||
      (viewport && (rect.right <= viewport.left || rect.left >= viewport.right))
    )
      return
    const style = getComputedStyle(node)
    const matrix = style.transform
      .match(/^matrix\(([^)]+)\)$/)?.[1]
      .split(',')
      .map(Number)
    const scaleX = matrix ? Math.hypot(matrix[0], matrix[1]) : 1
    const scaleY = matrix ? Math.hypot(matrix[2], matrix[3]) : 1
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: (parseFloat(style.width) || rect.width) * scaleX,
      height: (parseFloat(style.height) || rect.height) * scaleY,
      angle: matrix ? (Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI : 0,
    }
  }

  private playerPose(id: string): CardPose | undefined {
    const pose = this.pose(this.player(id))
    return pose && { ...pose, height: pose.width * 1.44 }
  }

  prepare(before: Room, after: Room, reduced: boolean): () => void {
    const skip = this.skipNext
    this.skipNext = false
    if (
      reduced ||
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.hidden ||
      skip ||
      before.id !== after.id ||
      before.state.you !== after.state.you ||
      (before.round ?? 1) !== (after.round ?? 1) ||
      after.state.phase !== 'playing'
    ) {
      this.clear()
      return () => {}
    }
    const deck = this.pose(this.surface.querySelector('[data-motion-deck]'))
    const captured: Flight[] = []
    for (const transfer of cardTransfers(before, after).slice(0, 6)) {
      const origin =
        transfer.kind === 'draw'
          ? deck
          : transfer.player === after.state.you
            ? this.pose(this.handCard(transfer.card))
            : this.playerPose(transfer.player)
      if (origin)
        captured.push({
          transfer,
          origin,
          previousFace:
            transfer.kind === 'play'
              ? (this.surface
                  .querySelector('[data-motion-discard] svg')
                  ?.cloneNode(true) as Element | undefined)
              : undefined,
          previousPose:
            transfer.kind === 'play'
              ? this.pose(
                  this.surface.querySelector(
                    '[data-motion-discard] .discard-card',
                  ),
                )
              : undefined,
        })
    }
    // Metadata/UNO updates neither cancel active cards nor invalidate a pending handoff.
    const revision = captured.length ? ++this.revision : this.revision
    const handChanged =
      before.state.players
        .find((p) => p.id === before.state.you)
        ?.hand?.map((c) => c.id)
        .join(',') !==
      after.state.players
        .find((p) => p.id === after.state.you)
        ?.hand?.map((c) => c.id)
        .join(',')
    return () => {
      if (revision !== this.revision || document.hidden) return
      for (const flight of this.flights) {
        if (
          (flight.landing && !flight.landing.isConnected) ||
          (handChanged && flight.hand)
        )
          flight.settle()
      }
      captured.forEach((flight, index) =>
        this.start(flight, after.state.you, Math.min(index, 2) * 40),
      )
    }
  }

  private overlay(face: Element, pose: CardPose, resting = false): HTMLElement {
    if (!this.layer) {
      this.layer = document.createElement('div')
      this.layer.className = 'table-motion-layer'
      this.layer.setAttribute('aria-hidden', 'true')
      document.body.append(this.layer)
    }
    const card = document.createElement('div')
    card.className = resting ? 'card-flight resting' : 'card-flight'
    card.setAttribute('aria-hidden', 'true')
    card.style.width = `${pose.width}px`
    card.style.height = `${pose.height}px`
    card.style.transform = poseTransform(pose, pose.width, pose.height)
    card.append(face.cloneNode(true))
    this.layer.append(card)
    return card
  }

  private start(flight: Flight, you: string, delay: number): void {
    const { transfer, origin } = flight
    const playing = transfer.kind === 'play'
    const hand = !playing && transfer.player === you
    const landing = playing
      ? this.surface.querySelector<HTMLElement>('.discard-inner')
      : hand
        ? this.handCard(transfer.card)
        : null
    const target = playing
      ? this.pose(
          this.surface.querySelector('[data-motion-discard] .discard-card'),
        )
      : hand
        ? this.pose(landing)
        : this.playerPose(transfer.player)
    const face = this.surface.querySelector(
      playing ? '[data-motion-discard] svg' : '[data-motion-deck] svg',
    )
    if (!target || !face) return
    const ghost = this.overlay(face, target)
    const resting =
      flight.previousFace && flight.previousPose
        ? this.overlay(flight.previousFace, flight.previousPose, true)
        : undefined
    const opacity = landing?.style.opacity ?? ''
    // The destination is hidden before the next paint, including newly drawn hand cards.
    if (landing) landing.style.opacity = '0'
    const easing = getComputedStyle(this.surface)
      .getPropertyValue('--ease-out')
      .trim()
    // Longer travel is deliberate: the player needs to follow the card across the table.
    const duration = 500
    const movement = ghost.animate(flightFrames(origin, target), {
      duration,
      delay,
      easing,
      fill: 'both',
    })
    const animations = [movement]
    const front = hand ? landing?.querySelector('svg') : null
    if (front) {
      const reveal = document.createElement('div')
      reveal.className = 'card-flight-front'
      reveal.style.filter = getComputedStyle(
        landing!.querySelector('.card-art') ?? landing!,
      ).filter
      reveal.append(front.cloneNode(true))
      ghost.append(reveal)
      animations.push(
        reveal.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 200,
          delay: delay + duration - 200,
          easing,
          fill: 'both',
        }),
      )
    }
    let settled = false
    const active: ActiveFlight = {
      hand,
      landing,
      settle: () => {
        if (settled) return
        settled = true
        // Reveal first, then remove an opaque, identically positioned overlay in one frame.
        if (landing) landing.style.opacity = opacity
        animations.forEach((animation) => animation.cancel())
        ghost.remove()
        resting?.remove()
        this.flights.delete(active)
        if (!this.flights.size) {
          this.layer?.remove()
          this.layer = undefined
        }
      },
    }
    this.flights.add(active)
    void movement.finished.then(active.settle, active.settle)
  }

  private settleHands(): void {
    for (const flight of this.flights) if (flight.hand) flight.settle()
  }

  clear(): void {
    this.revision++
    for (const flight of this.flights) flight.settle()
  }

  dispose(): void {
    this.clear()
    this.events.abort()
  }
}
