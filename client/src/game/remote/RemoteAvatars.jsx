import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Vector3 } from 'three'

import { PAD_YAW, padAt } from '@shared/world'

import { remotePlayers } from '../../net/remotePlayers'
import { getQuality } from '../../store/quality'
import { emoteFromAnim } from '../../bloxity/emotes'
import { asToyInstance } from '../blocks'
import { handPhoneGeometry } from '../handPhone'
import { RUN_CADENCE } from '../kick'
import { releasedBetween, releasePoint, repFraction, spawnThrow, THROW_RELEASE, THROW_TARGET_X, throwTargetZ } from '../practice'
import { sharedMaterials } from '../materials'
import { BloxityAvatar } from '../PlayerAvatar'

/** How often the set of fully drawn players is reconsidered. */
const PICK_MS = 500
/** Top walking speed: full stride amplitude, as for your own character. */
const MAX_SPEED = 10.875
const _up = new Vector3(0, 1, 0)
const _hand = new Vector3()

/**
 * One other player as their real Bloxity avatar, dressed as they are and holding their
 * phone, posed by the same playerPose as yours from what the network says they're doing:
 * walking pace, practising on a throw pad, jumping, winding up a throw at the edge. Their
 * drops play the throw (RemotePlayers works it out: `r.throwT`); the phone itself falls
 * on their own screen.
 */
function RemoteAvatar({ sessionId, look }) {
  const groupRef = useRef(null)
  const innerRef = useRef(null)
  const lastY = useRef(null)
  const handRef = useRef(null)
  const phoneRef = useRef(null)
  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: MAX_SPEED, vy: 0, stride: 0, windup: 0, throwT: 0 })
  /** Their phone in their hand: one mesh, its geometry swapped when they change phone. */
  const phone = useMemo(() => asToyInstance(handPhoneGeometry('bicycle'), sharedMaterials().toy), [])
  useEffect(() => () => phone.dispose(), [phone])

  useFrame((_state, rawDelta) => {
    const group = groupRef.current
    const inner = innerRef.current
    const r = remotePlayers.get(sessionId)
    if (!group || !inner || !r) return
    const delta = Math.min(rawDelta, 0.05)
    const m = motionRef.current
    m.time += delta
    group.visible = true
    m.run = 0
    m.emote = null
    m.windup = 0
    m.wobble = 0
    m.throwT = 0
    const geometry = handPhoneGeometry(r.tireId || 'bicycle')
    const held = phoneRef.current
    if (held && held.geometry !== geometry) held.geometry = geometry
    if (handRef.current) handRef.current.visible = !(r.flying && r.throwT >= 1)

    inner.position.set(0, 0, 0)
    inner.quaternion.identity()
    group.position.copy(r.position)
    const running = r.anim === 'run'
    if (r.flying || r.pulling) {
      // At the edge, facing out over it: winding up, or throwing.
      group.quaternion.setFromAxisAngle(_up, Math.PI)
      m.windup = r.pulling ? 0.85 : 0
      m.throwT = r.flying ? r.throwT : 0
      m.speed = 0
      m.grounded = true
      return
    }
    group.quaternion.setFromAxisAngle(_up, running ? PAD_YAW : r.yaw)
    // On a throw pad: practising, as you do - their phones fly down the lane too.
    m.run = running ? 1 : 0

    const speed = running ? 0 : r.speed
    m.speed = speed
    m.grounded = r.anim !== 'jump'
    // A Boxity emote they're playing (stood still while it lasts).
    m.emote = emoteFromAnim(r.anim)
    if (m.emote) m.speed = 0
    // Vertical speed from the interpolated height, smoothed: rising vs falling.
    const y = r.position.y
    if (lastY.current !== null) m.vy += ((y - lastY.current) / Math.max(delta, 1e-3) - m.vy) * 0.3
    lastY.current = y
    const rep = repFraction(m.stride)
    m.stride += delta * (running ? RUN_CADENCE : 5 + 6 * Math.min(1, speed / MAX_SPEED))
    if (running) {
      const pad = padAt(r.position.x, r.position.z, 1)
      if (pad >= 0 && releasedBetween(rep, repFraction(m.stride))) {
        releasePoint(r.position, _hand)
        spawnThrow(_hand.x, _hand.y, _hand.z, THROW_TARGET_X, throwTargetZ(pad), r.tireId || 'bicycle')
      }
      if (handRef.current && repFraction(m.stride) >= THROW_RELEASE) handRef.current.visible = false
    }
  })

  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        <BloxityAvatar equipped={look?.equipped} proportions={look?.proportions} motionRef={motionRef} handRef={handRef} targetHeight={1.8} />
        <group ref={handRef}>
          <primitive ref={phoneRef} object={phone} />
        </group>
      </group>
    </group>
  )
}

/**
 * The other players nearest the camera, as their real avatars - standing, walking or
 * training: as many as the quality preset allows (`remoteAvatars`), within
 * `remoteAvatarDistance` - on every preset, everyone in the room, near or far. Anyone
 * beyond those limits would be the cheap blocky figure RemotePlayers draws
 * (`r.fullAvatar` tells it who's covered).
 * Chosen twice a second, never per frame, so React only re-renders when the set of
 * players (or an outfit) actually changes.
 */
export function RemoteAvatars() {
  const camera = useThree((s) => s.camera)
  const [shown, setShown] = useState([])

  useEffect(() => {
    const pick = () => {
      const settings = getQuality()
      const near = []
      for (const r of remotePlayers.values()) {
        r.fullAvatar = false
        const d = camera.position.distanceTo(r.position)
        if (d < settings.remoteAvatarDistance) near.push([d, r])
      }
      near.sort((a, b) => a[0] - b[0])
      const next = near
        .slice(0, settings.remoteAvatars)
        .map(([, r]) => r)
        .sort((a, b) => (a.sessionId < b.sessionId ? -1 : 1))
      for (const r of next) r.fullAvatar = true
      setShown((prev) => {
        const same = prev.length === next.length && prev.every((p, i) => p.sessionId === next[i].sessionId && p.lookKey === next[i].lookKey)
        return same ? prev : next.map((r) => ({ sessionId: r.sessionId, look: r.look, lookKey: r.lookKey }))
      })
    }
    pick()
    const id = setInterval(pick, PICK_MS)
    return () => clearInterval(id)
  }, [camera])

  return (
    <>
      {shown.map((s) => (
        <Suspense key={`${s.sessionId}:${s.lookKey}`} fallback={null}>
          <RemoteAvatar sessionId={s.sessionId} look={s.look} />
        </Suspense>
      ))}
    </>
  )
}

export default RemoteAvatars
