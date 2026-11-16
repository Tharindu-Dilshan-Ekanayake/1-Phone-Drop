import { Vector3 } from 'three'

import { PAD_X, padCenterZ } from '@shared/world'

/**
 * Practice throws on the throw pads: you stand on a pad and throw your phone down its lane
 * at a target, over and over, a throw every rep (TRAIN_INTERVAL; the Skill itself comes
 * from the authority, as before). Shared by the pads' scenery (structures.js), the
 * throwers (Player, RemoteAvatars) and the phones in flight (PracticeThrows.jsx).
 */

/** The target's middle down each pad's lane (x), and the height of its top. */
export const THROW_TARGET_X = PAD_X + 7.6
export const THROW_TARGET_TOP = 0.15
/** Where pad `index`'s target is. */
export const throwTargetZ = (index) => padCenterZ(index)

/** How far through a rep (0-1) the phone leaves the hand. */
export const THROW_RELEASE = 0.6
/** Seconds a practice phone flies, lies on the target, and shrinks away. */
export const THROW_FLIGHT = 0.5
export const THROW_LIE = 0.5
export const THROW_FADE = 0.15

/** The phones in flight: a fixed pool, the oldest reused once it's full. */
export const MAX_THROWS = 10
export const throws = Array.from({ length: MAX_THROWS }, () => ({
  active: false,
  start: 0,
  from: new Vector3(),
  to: new Vector3(),
  phoneId: 'bicycle',
  /** Which way it tumbles and how much it turns, so no two throws look the same. */
  spin: 1,
  turn: 0,
  /** Whether its landing has been heard yet. */
  landed: false,
}))
let next = 0

/**
 * Throws phone `phoneId` from (x, y, z) - the thrower's hand - to the target at (toX, toZ).
 * Allocation-free: safe to call from a frame loop.
 */
export function spawnThrow(x, y, z, toX, toZ, phoneId) {
  const t = throws[next]
  next = (next + 1) % MAX_THROWS
  t.active = true
  t.start = performance.now()
  t.from.set(x, y, z)
  // Not dead centre every time: a little scatter round the bullseye.
  t.to.set(toX + (Math.random() - 0.5) * 0.9, THROW_TARGET_TOP, toZ + (Math.random() - 0.5) * 0.9)
  t.phoneId = phoneId
  t.spin = Math.random() < 0.5 ? 1 : -1
  t.turn = (Math.random() - 0.5) * 1.6
  t.landed = false
}

/** Fraction (0-1) of a rep at stride phase `stride` (radians, a rep per turn). */
export const repFraction = (stride) => {
  const f = (stride / (Math.PI * 2)) % 1
  return f < 0 ? f + 1 : f
}

/** Whether a rep's release fell between fractions `prev` and `now` (which may have wrapped). */
export const releasedBetween = (prev, now) => (prev <= now ? prev < THROW_RELEASE && now >= THROW_RELEASE : prev < THROW_RELEASE || now >= THROW_RELEASE)

/**
 * Where the phone leaves a thrower's right hand, standing at `pos` facing down the lane
 * (east, +X: their right side is +Z): up over the shoulder and a little forward.
 */
export function releasePoint(pos, out) {
  return out.set(pos.x + 0.55, pos.y + 2.25, pos.z + 0.35)
}
