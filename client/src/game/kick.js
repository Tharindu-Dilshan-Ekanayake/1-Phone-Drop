import { TRAIN_INTERVAL } from '@shared/balance'

/**
 * Training bits shared by your character, everyone else's and the sounds. (The file keeps
 * the template's name; the throw is launch.js and the drop roll/.)
 */

/**
 * Rep phase speed (radians a second) on a throw pad: one practice throw per TRAIN_INTERVAL, so every
 * rep lands a gain.
 */
export const RUN_CADENCE = (Math.PI * 2) / TRAIN_INTERVAL
