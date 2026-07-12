import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * Bridge to the native media3/ExoPlayer screen (Android only). Resolving the
 * debrid direct URL stays in JS; this just hands the ready URL to the native
 * player and relays its lifecycle/position events back.
 *
 * See android/.../NativePlayerPlugin.java + PlayerActivity.java.
 */
const NativePlayer = Capacitor.isNativePlatform() ? registerPlugin('NativePlayer') : null

export const isNativePlayerAvailable = !!NativePlayer

/**
 * Launch (or, if already open, hand a new file to) the native player.
 * @param {Object} opts
 * @param {string} opts.url            direct HTTPS stream URL
 * @param {string} [opts.title]        main title line
 * @param {string} [opts.subtitle]     secondary line (e.g. "S1 E2 · Name")
 * @param {number} [opts.startPercent] resume offset as a percentage 0-100
 *                                     (native derives ms once duration is known)
 * @param {Object} [opts.metadata]     echoed back on every event (for progress attribution)
 * @param {boolean} [opts.hasNext]     whether an auto-next episode exists
 */
export async function playNative({ url, title = '', subtitle = '', startPercent = 0, metadata = null, hasNext = false }) {
  if (!NativePlayer) return false
  await NativePlayer.play({
    url,
    title,
    subtitle,
    startPercent: Number(startPercent) || 0,
    metadataJson: JSON.stringify(metadata || {}),
    hasNext: !!hasNext,
  })
  return true
}

/**
 * Play a magnet via native torrent streaming (libtorrent4j) — no debrid.
 * Same options as playNative but takes a `magnet` instead of a `url`.
 */
export async function playTorrentNative({ magnet, title = '', subtitle = '', startPercent = 0, metadata = null, hasNext = false }) {
  if (!NativePlayer) return false
  await NativePlayer.playTorrent({
    magnet,
    title,
    subtitle,
    startPercent: Number(startPercent) || 0,
    metadataJson: JSON.stringify(metadata || {}),
    hasNext: !!hasNext,
  })
  return true
}

export async function stopNative() {
  if (!NativePlayer) return
  await NativePlayer.stop()
}

/** Fetch the persistent native crash/error log (see AppLogger.java). */
export async function getNativeLogs() {
  if (!NativePlayer) return ''
  const { logs } = await NativePlayer.getLogs()
  return logs || ''
}

export async function clearNativeLogs() {
  if (!NativePlayer) return
  await NativePlayer.clearLogs()
}

/** Funnel a JS-side error into the same persistent log file as native crashes. */
export async function logClientError(tag, message) {
  if (!NativePlayer) return
  try {
    await NativePlayer.logClientError({ tag, message })
  } catch {
    // logging must never itself throw
  }
}

/**
 * Subscribe to a native player event. Returns an unsubscribe function.
 * Events: progress, paused, resumed, ended, playNext, closed, error.
 * Every payload carries `metadata` (JSON string) + positionMs/durationMs.
 */
export function onNativePlayerEvent(event, cb) {
  if (!NativePlayer) return () => {}
  let handle = null
  NativePlayer.addListener(event, (data) => {
    let metadata = null
    try {
      metadata = data?.metadata ? JSON.parse(data.metadata) : null
    } catch {
      metadata = null
    }
    cb({ ...data, metadata })
  }).then((l) => {
    handle = l
  })
  return () => handle?.remove()
}
